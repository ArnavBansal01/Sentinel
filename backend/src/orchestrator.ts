import { randomUUID } from "node:crypto";
import { SenseAgent } from "./agents/sense/senseAgent.js";
import { DecideAgent } from "./agents/decide/decideAgent.js";
import { ActAgent } from "./agents/act/actAgent.js";
import { repository, db } from "./persistence/database.js";
import { publish } from "./events/eventBus.js";
import type { LedgerEntry } from "./types/domain.js";
export async function orchestrate(shipmentId: string, requestId: string = randomUUID(), forceDemo = false) {
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
  const disruption = await (forceDemo ? SenseAgent.demo() : new SenseAgent()).run(shipment, traceId);
  repository.saveDisruption(disruption);
  if (!disruption.exists) {
    shipment.currentState = "MONITORED";
    if (shipment.status === "disrupted" || shipment.status === "pending_approval") shipment.status = "monitoring";
    repository.saveShipment(shipment);
    publish(traceId, "sense", "sense.no_disruption", shipment.id, "No verified disruption; decision and action stages skipped");
    const result = {
      traceId,
      requestId,
      shipment: repository.shipment(shipmentId),
      disruption,
      decision: null,
      action: null,
    };
    db.prepare("UPDATE requests SET result_json=? WHERE request_id=?").run(JSON.stringify(result), requestId);
    return result;
  }
  shipment.currentState = "DISRUPTION_DETECTED";
  repository.saveShipment(shipment);
  const decision = await new DecideAgent().run(shipment, disruption, traceId, requestId, forceDemo);
  repository.saveDecision(decision);
  let action: unknown = null;
  if (decision.overallStatus === "AUTO_COMMIT") {
    shipment.currentState = "ACT_RUNNING";
    repository.saveShipment(shipment);
    action = await new ActAgent().run(shipment, decision, traceId);
  } else {
    shipment.currentState =
      decision.overallStatus === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "POLICY_REFUSED";
    shipment.status =
      decision.overallStatus === "PENDING_APPROVAL" ? "pending_approval" : "escalated";
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
  const traceId = randomUUID();
  if (kind === "reject") {
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
    const target = d.options.find((o) => o.id === optionId && o.status === "viable");
    if (!target) throw Object.assign(new Error("Override option is not viable"), { status: 400 });
    d.recommendedOption = target.id;
  }
  d.overallStatus = kind === "approve" ? "APPROVED" : "OVERRIDDEN";
  s.currentState = "APPROVED";
  repository.saveShipment(s);
  return new ActAgent().run(s, d, traceId, `HUMAN / APPROVER (${kind})`);
}
