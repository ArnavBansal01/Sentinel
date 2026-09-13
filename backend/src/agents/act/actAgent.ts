import { randomUUID } from "node:crypto";
import { repository } from "../../persistence/database.js";
import { publish } from "../../events/eventBus.js";
import {
  ConsoleNotificationProvider,
  WebhookNotificationProvider,
} from "./notificationExecutor.js";
import type { Decision, LedgerEntry, Shipment } from "../../types/domain.js";
export class ActAgent {
  async run(s: Shipment, d: Decision, traceId: string, actor = "SYSTEM / AUTONOMOUS") {
    const old = repository.actionByDecision(d.id);
    if (old) return JSON.parse(old.json) as unknown;
    const option = d.options.find((o) => o.id === d.recommendedOption && o.status === "viable");
    if (!option) throw new Error("No viable selected option");
    publish(traceId, "act", "act.started", s.id, "Action execution started");
    const actionId = randomUUID();
    s.selectedRoute = option.route;
    s.etaIso = new Date(Date.parse(s.etaIso) + option.delayDays * 86400000).toISOString();
    s.riskScore = option.riskScore;
    s.status = "recovered";
    s.currentState = "COMMITTED";
    repository.saveShipment(s);
    publish(
      traceId,
      "act",
      "act.route_updated",
      s.id,
      `Route and ETA updated for ${option.type}`,
      s.selectedRoute,
    );
    const payload = { shipmentId: s.id, decisionId: d.id, option: option.type, newEta: s.etaIso };
    const provider = process.env["WEBHOOK_URL"]
      ? new WebhookNotificationProvider(process.env["WEBHOOK_URL"])
      : new ConsoleNotificationProvider();
    const notification = await provider.send(payload);
    publish(
      traceId,
      "act",
      "act.notification_created",
      s.id,
      `Notification ${notification.delivery}`,
      notification,
    );
    publish(traceId, "act", "act.completed", s.id, "Action committed successfully");
    const ledger: LedgerEntry = {
      id: randomUUID(),
      traceId,
      timestamp: new Date().toISOString(),
      shipmentId: s.id,
      decisionId: d.id,
      actionId,
      eventType: "DECISION_COMMITTED",
      actor,
      payload: {
        decision: d,
        selectedOption: option,
        shipment: s,
        disruption: repository.disruption(s.id),
        notification,
        reasoning: {
          modelReasoning: d.reasoning,
          evidenceUsed: repository.disruption(s.id)?.evidence ?? [],
          policyRulesTriggered: d.policyRulesTriggered,
          refusedOptions: d.options.filter((candidate) => candidate.status === "refused"),
          selectedBecause: option.reason,
          alternativesNotSelected: d.options
            .filter((candidate) => candidate.id !== option.id)
            .map((candidate) => ({
              optionId: candidate.id,
              type: candidate.type,
              status: candidate.status,
              reason:
                candidate.policyReasons[0] ?? "Lower-ranked against cost, delay, fuel and risk.",
            })),
        },
        logs: repository
          .activity()
          .filter((event) => event.traceId === traceId)
          .reverse(),
      },
    };
    repository.saveAction(actionId, d.id, s.id, {
      actionId,
      shipment: s,
      decision: d,
      notification,
      ledgerId: ledger.id,
    });
    repository.appendLedger(ledger);
    publish(
      traceId,
      "ledger",
      "ledger.appended",
      s.id,
      `Immutable ledger entry ${ledger.id} appended`,
      ledger,
    );
    return { actionId, shipment: s, decision: d, notification, ledgerId: ledger.id };
  }
}
