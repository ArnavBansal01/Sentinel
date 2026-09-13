import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { askGemini } from "./geminiClient.js";
import { routeFor } from "../../routing/routeEngine.js";
import { applyPolicy } from "../../policy/policyEngine.js";
import { publish } from "../../events/eventBus.js";
import type {
  Decision,
  DecisionOption,
  DisruptionAssessment,
  OptionType,
  Shipment,
} from "../../types/domain.js";
function demo(s: Shipment) {
  const specs: Record<OptionType, [number, number, number, number, string]> = {
    reroute: [
      82000,
      s.id === "SF-1002" ? 8 : 3,
      420,
      24,
      "Avoid the disrupted corridor using validated waypoints.",
    ],
    respeed: [58000, 1, 1100, 43, "Increase speed on safe legs to recover schedule."],
    switch_mode: [126000, 2, 120, 29, "Use an alternative port and protected onward transport."],
  };
  return {
    options: (Object.keys(specs) as OptionType[]).map((type) => {
      const [cost, delay, fuel, risk, reason] = specs[type];
      return {
        type,
        status: "viable" as const,
        costUsd: cost,
        delayDays: delay,
        fuelTonnes: fuel,
        riskScore: risk,
        reason,
      };
    }),
    doNothing: {
      costUsd: 210000,
      delayDays: 9,
      fuelTonnes: 0,
      riskScore: 86,
      reason: "Absorb congestion, detention, and service failure exposure.",
    },
    recommendedOption: s.id === "SF-1002" ? ("respeed" as const) : ("reroute" as const),
    reasoning:
      "Compared route feasibility, delay, fuel, risk, evidence confidence, cargo constraints, and the economic baseline.",
  };
}
export class DecideAgent {
  async run(
    s: Shipment,
    d: DisruptionAssessment,
    traceId: string,
    requestId: string,
    forceDemo = false,
  ): Promise<Decision> {
    const useDemo = forceDemo || config.mode === "DEMO";
    publish(traceId, "decide", "decide.started", s.id, useDemo ? "Demo decision started" : "AI decision started");
    const result = useDemo ? ({ ok: false, reason: "showcase_demo" } as const) : await askGemini(s, d);
    if (!result.ok && !useDemo)
      throw Object.assign(new Error(result.reason), { code: "GEMINI_PROVIDER_FAILED" });
    const raw = result.ok ? result.value : demo(s);
    const options: DecisionOption[] = raw.options.map((o) => ({
      ...o,
      id: `${requestId}-${o.type}`,
      policyReasons: [],
      route: routeFor(s, o.type),
    }));
    const decision: Decision = {
      id: randomUUID(),
      requestId,
      shipmentId: s.id,
      disruptionId: d.eventId,
      overallStatus: "DECISION_READY",
      options,
      doNothing: raw.doNothing,
      recommendedOption: `${requestId}-${raw.recommendedOption}`,
      reasoning: raw.reasoning,
      provider: result.ok ? "gemini" : "deterministic_demo",
      providerStatus: result.ok ? "completed" : "demo",
      policyRulesTriggered: [],
      createdAt: new Date().toISOString(),
    };
    for (const o of options)
      publish(
        traceId,
        "decide",
        "decide.option_generated",
        s.id,
        `${o.type}: $${o.costUsd}, ${o.delayDays} days, ${o.fuelTonnes} tonnes`,
        o,
      );
    publish(
      traceId,
      "decide",
      "decide.completed",
      s.id,
      `${decision.provider} decision schema validation passed`,
    );
    publish(traceId, "policy", "policy.started", s.id, "Deterministic policy evaluation started");
    applyPolicy(s, decision);
    for (const o of options.filter((x) => x.status === "refused"))
      publish(traceId, "policy", "policy.refusal", s.id, o.policyReasons.join(" "), o);
    if (decision.overallStatus === "PENDING_APPROVAL")
      publish(
        traceId,
        "policy",
        "policy.approval_required",
        s.id,
        decision.policyRulesTriggered.join(", "),
      );
    publish(
      traceId,
      "policy",
      "policy.completed",
      s.id,
      `Policy result: ${decision.overallStatus}`,
      decision,
    );
    return decision;
  }
}
