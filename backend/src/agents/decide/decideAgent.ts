import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { askGemini } from "./geminiClient.js";
import { routeFor } from "../../routing/routeEngine.js";
import { applyPolicy } from "../../policy/policyEngine.js";
import { publish } from "../../events/eventBus.js";
import {
  estimateDoNothing,
  estimateRecoveryOption,
  optionValueScore,
} from "../../economics/costEstimator.js";
import type {
  Decision,
  DecisionOption,
  DisruptionAssessment,
  OptionType,
  Shipment,
} from "../../types/domain.js";
function demo() {
  const specs: Record<OptionType, string> = {
    reroute: "Avoid the disrupted corridor using validated waypoints.",
    respeed: "Increase speed on safe legs to recover schedule.",
    switch_mode: "Use an alternative port and protected onward transport.",
  };
  return {
    options: (Object.keys(specs) as OptionType[]).map((type) => {
      return {
        type,
        status: "viable" as const,
        costUsd: 0,
        delayDays: 0,
        fuelTonnes: 0,
        riskScore: 0,
        reason: specs[type],
      };
    }),
    doNothing: {
      costUsd: 0,
      delayDays: 0,
      fuelTonnes: 0,
      riskScore: 0,
      reason: "No recovery action is taken.",
    },
    recommendedOption: "reroute" as const,
    reasoning:
      "Compared route feasibility, voyage time, fuel, cargo exposure, handling cost, risk, and the cost of taking no action.",
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
    publish(
      traceId,
      "decide",
      "decide.started",
      s.id,
      useDemo ? "Demo decision started" : "AI decision started",
    );
    const result = useDemo
      ? ({ ok: false, reason: "showcase_demo" } as const)
      : await askGemini(s, d);
    if (!result.ok && !useDemo)
      throw Object.assign(new Error(result.reason), { code: "GEMINI_PROVIDER_FAILED" });
    const raw = result.ok ? result.value : demo();
    const options: DecisionOption[] = raw.options.map((o) => {
      const route = routeFor(s, o.type);
      return {
        ...o,
        ...estimateRecoveryOption(s, o.type, route),
        id: `${requestId}-${o.type}`,
        policyReasons: [],
        route,
      };
    });
    const eligibleForRecommendation = options.filter(
      (option) => !(s.coldChain && option.type === "respeed"),
    );
    const recommended = [...eligibleForRecommendation].sort(
      (a, b) => optionValueScore(a) - optionValueScore(b),
    )[0];
    const doNothing = estimateDoNothing(s, d);
    const decision: Decision = {
      id: randomUUID(),
      requestId,
      shipmentId: s.id,
      disruptionId: d.eventId,
      overallStatus: "DECISION_READY",
      options,
      doNothing,
      recommendedOption: recommended?.id ?? `${requestId}-${raw.recommendedOption}`,
      reasoning: `${raw.reasoning} Route-specific costs were calculated by Sentinel's voyage estimator using distance, speed-related fuel burn, bunker price, vessel time, handling, cargo protection, and risk reserve.`,
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
