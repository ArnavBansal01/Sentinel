import type { Decision, Shipment } from "../types/domain.js";
import { optionValueScore } from "../economics/costEstimator.js";
export const thresholds = { cargoValueUsd: 1_000_000, delayDays: 7, fuelTonnes: 1_000 };
export function applyPolicy(s: Shipment, d: Decision) {
  const triggered: string[] = [];
  for (const o of d.options) {
    if (s.coldChain && o.type === "respeed") {
      o.status = "refused";
      o.policyReasons.push("Re-speed violates cold-chain operational constraints.");
    }
    if (o.delayDays > thresholds.delayDays)
      o.policyReasons.push("Added transit time exceeds 7 days; human approval required.");
    if (o.fuelTonnes > thresholds.fuelTonnes)
      o.policyReasons.push("Additional bunker fuel exceeds 1,000 tonnes; human approval required.");
  }
  let recommended = d.options.find((o) => o.id === d.recommendedOption);
  if (!recommended || recommended.status === "refused") {
    recommended = d.options
      .filter((o) => o.status === "viable")
      .sort((a, b) => optionValueScore(a) - optionValueScore(b))[0];
    d.recommendedOption = recommended?.id ?? null;
  }
  if (recommended && recommended.delayDays > thresholds.delayDays)
    triggered.push("TRANSIT_TIME_GT_7_DAYS");
  if (recommended && recommended.fuelTonnes > thresholds.fuelTonnes)
    triggered.push("BUNKER_FUEL_GT_1000_TONNES");
  if (s.cargoValueUsd > thresholds.cargoValueUsd)
    triggered.push("CARGO_VALUE_AT_RISK_GT_1000000_USD");
  if (s.coldChain) triggered.push("COLD_CHAIN_HUMAN_APPROVAL");
  d.policyRulesTriggered = [...new Set(triggered)];
  d.overallStatus = d.recommendedOption
    ? triggered.length
      ? "PENDING_APPROVAL"
      : "AUTO_COMMIT"
    : "POLICY_REFUSED";
  return d;
}
