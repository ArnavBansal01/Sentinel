import { randomUUID } from "node:crypto";
import { SenseAgent } from "./agents/sense/senseAgent.js";
import { DecideAgent } from "./agents/decide/decideAgent.js";
import { ActAgent } from "./agents/act/actAgent.js";
import { repository, db } from "./persistence/database.js";
import { publish } from "./events/eventBus.js";
import type { LedgerEntry } from "./types/domain.js";

const DEFAULT_REVIEW_WINDOW_MS = 2 * 60 * 60 * 1000;

function reviewWindowMs() {
  const configured = Number(process.env["SYSTEM_REVIEW_WINDOW_MS"] ?? DEFAULT_REVIEW_WINDOW_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_REVIEW_WINDOW_MS;
}
export async function orchestrate(
  shipmentId: string,
  requestId: string = randomUUID(),
  forceDemo = false,
) {
  const traceId = randomUUID();
  const existing = db
    .prepare("SELECT result_json FROM requests WHERE request_id=?")
    .get(requestId) as { result_json: string | null } | undefined;
  if (existing?.result_json) return JSON.parse(existing.result_json) as unknown;
  const shipment = repository.shipment(shipmentId);
  if (!shipment) throw Object.assign(new Error("Shipment not found"), { status: 404 });
  db.prepare("INSERT OR IGNORE INTO requests(request_id,shipment_id) VALUES(?,?)").run(
    requestId,
    shipmentId,
  );
  shipment.currentState = "SENSE_RUNNING";
  repository.saveShipment(shipment);
  const injectedDisruption = forceDemo ? undefined : repository.demoInjection(shipment.id);
  const disruption = injectedDisruption
    ? injectedDisruption
    : await (forceDemo ? SenseAgent.demo() : new SenseAgent()).run(shipment, traceId);
  if (injectedDisruption) {
    publish(
      traceId,
      "sense",
      "sense.started",
      shipment.id,
      "Checking live inputs and pending demo disruptions",
    );
    for (const signal of injectedDisruption.evidence)
      publish(
        traceId,
        "sense",
        "sense.signal_received",
        shipment.id,
        `DEMO ${signal.type}: ${signal.title}`,
        signal,
      );
    publish(
      traceId,
      "sense",
      "sense.disruption_detected",
      shipment.id,
      `Pending demo disruption detected at ${injectedDisruption.location}`,
      injectedDisruption,
    );
  }
  repository.saveDisruption(disruption);
  if (!disruption.exists) {
    shipment.currentState = "MONITORED";
    if (shipment.status === "disrupted" || shipment.status === "pending_approval")
      shipment.status = "monitoring";
    repository.saveShipment(shipment);
    publish(
      traceId,
      "sense",
      "sense.no_disruption",
      shipment.id,
      "No verified disruption; decision and action stages skipped",
    );
    const result = {
      traceId,
      requestId,
      shipment: repository.shipment(shipmentId),
      disruption,
      decision: null,
      action: null,
    };
    db.prepare("UPDATE requests SET result_json=? WHERE request_id=?").run(
      JSON.stringify(result),
      requestId,
    );
    return result;
  }
  shipment.currentState = "DISRUPTION_DETECTED";
  repository.saveShipment(shipment);
  const decision = await new DecideAgent().run(
    shipment,
    disruption,
    traceId,
    requestId,
    forceDemo || Boolean(injectedDisruption),
  );
  const autonomousDecision = ["AUTO_COMMIT", "AUTO_COMMIT_NOTIFY"].includes(decision.overallStatus);
  if (decision.overallStatus === "AUTO_COMMIT_NOTIFY") {
    publish(
      traceId,
      "policy",
      "policy.planner_notification_required",
      shipment.id,
      "Tier 2 decision is eligible for autonomous commit; Planner notification required",
    );
  }
  const timedReview = autonomousDecision && reviewWindowMs() > 0;
  if (timedReview) {
    decision.overallStatus = "PENDING_APPROVAL";
    decision.autoCommitAfterReview = true;
    decision.reviewDeadlineIso = new Date(Date.now() + reviewWindowMs()).toISOString();
    publish(
      traceId,
      "policy",
      "policy.review_window_started",
      shipment.id,
      `Optional approver review open until ${decision.reviewDeadlineIso}`,
      { reviewDeadlineIso: decision.reviewDeadlineIso },
    );
  } else if (["PENDING_APPROVAL", "ESCALATED"].includes(decision.overallStatus)) {
    decision.autoCommitAfterReview = false;
  }
  repository.saveDecision(decision);
  let action: unknown = null;
  if (["AUTO_COMMIT", "AUTO_COMMIT_NOTIFY"].includes(decision.overallStatus)) {
    shipment.currentState = "ACT_RUNNING";
    repository.saveShipment(shipment);
    action = await new ActAgent().run(shipment, decision, traceId);
  } else {
    const awaitingApproval = ["PENDING_APPROVAL", "ESCALATED"].includes(decision.overallStatus);
    shipment.currentState = awaitingApproval ? "PENDING_APPROVAL" : "POLICY_REFUSED";
    shipment.status = awaitingApproval ? "pending_approval" : "escalated";
    repository.saveShipment(shipment);
  }
  const result = {
    traceId,
    requestId,
    shipment: repository.shipment(shipmentId),
    disruption,
    decision,
    action,
  };
  db.prepare("UPDATE requests SET result_json=? WHERE request_id=?").run(
    JSON.stringify(result),
    requestId,
  );
  if (injectedDisruption) repository.consumeDemoInjection(shipment.id, requestId);
  return result;
}
export async function approve(
  shipmentId: string,
  kind: "approve" | "reject" | "override",
  role: string,
  optionId?: string,
) {
  if (role !== "approver")
    throw Object.assign(new Error("Approver role required"), { status: 403 });
  const s = repository.shipment(shipmentId),
    d = repository.decision(shipmentId);
  if (!s || !d) throw Object.assign(new Error("Pending decision not found"), { status: 404 });
  if (s.currentState !== "PENDING_APPROVAL")
    throw Object.assign(new Error("Shipment is not pending approval"), { status: 409 });
  if (
    d.autoCommitAfterReview &&
    d.reviewDeadlineIso &&
    Date.parse(d.reviewDeadlineIso) <= Date.now()
  ) {
    await commitExpiredReviews();
    throw Object.assign(
      new Error("The two-hour review window has ended and the plan was applied"),
      {
        status: 409,
      },
    );
  }
  const traceId = randomUUID();
  const overrideTarget =
    kind === "override"
      ? d.options.find((option) => option.id === optionId && option.status === "viable")
      : undefined;
  if (kind === "override" && !overrideTarget)
    throw Object.assign(new Error("Override option is not viable"), { status: 400 });
  if (
    kind !== "reject" &&
    d.secondaryApprovalRequired === true &&
    (d.approvalStepsCompleted ?? 0) < 1
  ) {
    if (overrideTarget) d.recommendedOption = overrideTarget.id;
    d.approvalStepsCompleted = 1;
    repository.updateDecision(d);
    publish(
      traceId,
      "policy",
      "policy.secondary_review_required",
      s.id,
      "Tier 4 first approval recorded; secondary review still required",
      { approvalStepsCompleted: 1, approvalStepsRequired: 2 },
    );
    return { shipment: s, decision: d, status: "SECONDARY_REVIEW_REQUIRED" };
  }
  if (kind === "reject") {
    d.autoCommitAfterReview = false;
    repository.updateDecision(d);
    s.currentState = "ESCALATED";
    s.status = "escalated";
    repository.saveShipment(s);
    publish(traceId, "policy", "policy.completed", s.id, "Decision rejected and escalated");
    const ledger: LedgerEntry = {
      id: randomUUID(),
      traceId,
      timestamp: new Date().toISOString(),
      shipmentId: s.id,
      decisionId: d.id,
      eventType: "DECISION_REJECTED",
      actor: "HUMAN / APPROVER (reject)",
      payload: {
        decision: d,
        shipment: s,
        disruption: repository.disruption(s.id),
        reasoning: {
          modelReasoning: d.reasoning,
          humanOutcome: "Rejected and escalated without operational execution.",
          policyRulesTriggered: d.policyRulesTriggered,
        },
        logs: repository
          .activity()
          .filter((event) => event.traceId === traceId)
          .reverse(),
      },
    };
    repository.appendLedger(ledger);
    publish(traceId, "ledger", "ledger.appended", s.id, `Rejection ledger ${ledger.id} appended`);
    return { shipment: s, decision: d, status: "REJECTED", ledgerId: ledger.id };
  }
  if (kind === "override") {
    d.recommendedOption = overrideTarget!.id;
  }
  d.overallStatus = kind === "approve" ? "APPROVED" : "OVERRIDDEN";
  d.autoCommitAfterReview = false;
  repository.updateDecision(d);
  s.currentState = "APPROVED";
  repository.saveShipment(s);
  return new ActAgent().run(s, d, traceId, `HUMAN / APPROVER (${kind})`);
}

export async function commitExpiredReviews(now = new Date()) {
  const committed: string[] = [];
  for (const decision of repository.expiredTimedReviews(now.toISOString())) {
    const shipment = repository.shipment(decision.shipmentId);
    const latest = repository.decision(decision.shipmentId);
    if (!shipment || shipment.currentState !== "PENDING_APPROVAL" || latest?.id !== decision.id)
      continue;

    const traceId = randomUUID();
    decision.overallStatus = "AUTO_COMMIT";
    decision.autoCommitAfterReview = false;
    repository.updateDecision(decision);
    publish(
      traceId,
      "policy",
      "policy.review_window_expired",
      shipment.id,
      "No approver change was made; applying the recommended plan automatically",
      { reviewDeadlineIso: decision.reviewDeadlineIso },
    );
    await new ActAgent().run(shipment, decision, traceId, "SYSTEM / REVIEW WINDOW EXPIRED");
    committed.push(shipment.id);
  }
  return committed;
}
