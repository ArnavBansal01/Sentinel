import type {
  Decision,
  DecisionOption,
  DisruptionAssessment,
  RiskAssessment,
  RiskCriterion,
  RiskTier,
  Shipment,
} from "../types/domain.js";
import { optionValueScore } from "../economics/costEstimator.js";

export const thresholds = { cargoValueUsd: 1_000_000, delayDays: 7, fuelTonnes: 1_000 };

const criterion = (
  key: RiskCriterion["key"],
  label: string,
  score: number,
  detail: string,
  includedInTotal = true,
): RiskCriterion => ({ key, label, score, detail, includedInTotal });

const has = (shipment: Shipment, terms: string[]) => {
  const text = `${shipment.cargo} ${shipment.constraints.join(" ")}`.toLowerCase();
  return terms.some((term) => text.includes(term));
};

function timeScore(days: number) {
  return days < 1 ? 0 : days <= 3 ? 1 : days <= 7 ? 2 : 3;
}
function costScore(costUsd: number, cargoValueUsd: number) {
  const percent = cargoValueUsd > 0 ? (costUsd / cargoValueUsd) * 100 : 100;
  return { percent, score: percent < 2 ? 0 : percent <= 5 ? 1 : percent <= 15 ? 2 : 3 };
}
function cargoValueScore(value: number) {
  return value < 100_000 ? 0 : value <= 500_000 ? 1 : value <= 1_500_000 ? 2 : 3;
}
function latenessScore(shipment: Shipment) {
  if (
    shipment.priority === "critical" ||
    has(shipment, ["life-safety", "production stoppage", "contract loss"])
  )
    return 3;
  if (
    shipment.priority === "high" ||
    has(shipment, ["sla", "demurrage", "contract", "delivery window"])
  )
    return 2;
  return shipment.priority === "standard" ? 1 : 0;
}
function regulatoryScore(shipment: Shipment) {
  if (has(shipment, ["sanction", "contested", "war-risk", "approval may be denied"])) return 3;
  if (has(shipment, ["customs", "regulated", "gdp-certified", "hazmat"])) return 2;
  return has(shipment, ["approval", "permit"]) ? 1 : 0;
}
function downstreamScore(shipment: Shipment) {
  if (shipment.downstreamCriticality !== undefined) return shipment.downstreamCriticality;
  if (has(shipment, ["critical dependency", "no buffer", "just-in-time", "relief"])) return 3;
  return shipment.priority === "critical" ? 2 : shipment.priority === "high" ? 1 : 0;
}

export function computeRiskTier(
  shipment: Shipment,
  disruption: Pick<DisruptionAssessment, "confidence">,
  option: DecisionOption,
): RiskAssessment {
  const cost = costScore(option.costUsd, shipment.cargoValueUsd);
  const lateness = latenessScore(shipment);
  const shelfBuffer =
    shipment.shelfLifeDays === undefined ? null : shipment.shelfLifeDays - option.delayDays;
  const shelfScore =
    shelfBuffer === null
      ? 0
      : shelfBuffer < 0
        ? 3
        : shelfBuffer <= 3
          ? 2
          : shelfBuffer <= 7
            ? 1
            : 0;
  const regulatory = regulatoryScore(shipment);
  const feasibilityScore =
    option.feasibility === "confirmed" ? 0 : option.feasibility === "uncertain" ? 2 : 3;
  const criteria: RiskCriterion[] = [
    criterion(
      "time_impact",
      "Time impact",
      timeScore(option.delayDays),
      `${option.delayDays} additional day(s)`,
    ),
    criterion(
      "cost_impact",
      "Cost vs cargo value",
      cost.score,
      `${cost.percent.toFixed(1)}% of cargo value`,
    ),
    criterion(
      "shelf_life",
      "Shelf-life buffer",
      shelfScore,
      shelfBuffer === null
        ? "Not applicable or not provided"
        : `${shelfBuffer.toFixed(1)} day(s) remain after delay`,
    ),
    criterion(
      "lateness_impact",
      "Impact of lateness",
      lateness,
      shipment.priority
        ? `${shipment.priority} shipment priority`
        : lateness >= 2
          ? "Contract, SLA, or delivery-window exposure identified"
          : "No critical dependency supplied",
    ),
    criterion(
      "regulatory_delay",
      "Regulatory delay",
      regulatory,
      regulatory === 0
        ? "No special approval identified"
        : "Constraints require regulatory or customs review",
    ),
    criterion(
      "cargo_value",
      "Cargo value at risk",
      cargoValueScore(shipment.cargoValueUsd),
      `$${shipment.cargoValueUsd.toLocaleString("en-US")}`,
    ),
    criterion(
      "detection_confidence",
      "Detection confidence",
      disruption.confidence < 0.62 ? 3 : 0,
      `${Math.round(disruption.confidence * 100)}% corroborated confidence`,
      false,
    ),
    criterion(
      "feasibility",
      "Option availability",
      feasibilityScore,
      option.feasibility === "confirmed"
        ? "Operationally available in this planning model"
        : option.feasibility === "uncertain"
          ? "Capacity must be confirmed before execution"
          : "Known unavailable",
      false,
    ),
    criterion(
      "downstream_exposure",
      "Downstream exposure",
      downstreamScore(shipment),
      "Dependency and priority impact",
      false,
    ),
  ];
  const score = criteria
    .filter((item) => item.includedInTotal)
    .reduce((sum, item) => sum + item.score, 0);
  const hardOverrides: string[] = [];
  let tier: RiskTier = score <= 4 ? 1 : score <= 8 ? 2 : score <= 13 ? 3 : 4;

  if (shelfScore === 3)
    hardOverrides.push("Added delay exceeds the remaining shelf life; option is not deliverable.");
  if (regulatory === 3) {
    tier = 4;
    hardOverrides.push(
      "Regulatory approval may be denied or indefinitely delayed; Tier 4 minimum enforced.",
    );
  }
  if (disruption.confidence < 0.62 && tier < 3) {
    tier = 3;
    hardOverrides.push("Detection confidence is below 62%; autonomous commitment is disabled.");
  }
  if (shipment.coldChain && tier < 3) {
    tier = 3;
    hardOverrides.push("Cold-chain custody requires human review.");
  }
  if (option.delayDays > thresholds.delayDays && tier < 3) tier = 3;
  if (option.fuelTonnes > thresholds.fuelTonnes && tier < 3) tier = 3;
  if (shipment.cargoValueUsd > thresholds.cargoValueUsd && tier < 3) tier = 3;

  const labels: Record<RiskTier, RiskAssessment["label"]> = {
    1: "Negligible",
    2: "Low",
    3: "Elevated",
    4: "Critical",
  };
  const behaviors: Record<RiskTier, RiskAssessment["behavior"]> = {
    1: "AUTO_COMMIT",
    2: "AUTO_COMMIT_NOTIFY",
    3: "PENDING_APPROVAL",
    4: "ESCALATED",
  };
  return { tier, label: labels[tier], score, criteria, hardOverrides, behavior: behaviors[tier] };
}

export function applyPolicy(
  shipment: Shipment,
  disruptionOrDecision: DisruptionAssessment | Decision,
  maybeDecision?: Decision,
) {
  const decision = maybeDecision ?? (disruptionOrDecision as Decision);
  const disruption = maybeDecision
    ? (disruptionOrDecision as DisruptionAssessment)
    : ({ confidence: 1 } as DisruptionAssessment);
  const triggered: string[] = [];

  for (const option of decision.options) {
    option.riskAssessment = computeRiskTier(shipment, disruption, option);
    if (shipment.coldChain && option.type === "respeed") {
      option.status = "refused";
      option.policyReasons.push("Re-speed violates cold-chain operational constraints.");
    }
    if (option.riskAssessment.criteria.find((item) => item.key === "shelf_life")?.score === 3) {
      option.status = "refused";
      option.policyReasons.push("Added delay exceeds remaining cargo shelf life.");
    }
    if (option.feasibility === "unavailable") {
      option.status = "refused";
      option.policyReasons.push("Required operational capacity is known to be unavailable.");
    }
    if (option.delayDays > thresholds.delayDays)
      option.policyReasons.push("Added transit time exceeds 7 days; human approval required.");
    if (option.fuelTonnes > thresholds.fuelTonnes)
      option.policyReasons.push(
        "Additional bunker fuel exceeds 1,000 tonnes; human approval required.",
      );
  }

  let recommended = decision.options.find((option) => option.id === decision.recommendedOption);
  if (!recommended || recommended.status === "refused") {
    recommended = decision.options
      .filter((option) => option.status === "viable")
      .sort((a, b) => optionValueScore(a) - optionValueScore(b))[0];
    decision.recommendedOption = recommended?.id ?? null;
  }
  if (!recommended) {
    decision.policyRulesTriggered = ["NO_VIABLE_RECOVERY_OPTION"];
    decision.overallStatus = "POLICY_REFUSED";
    return decision;
  }

  const assessment = recommended.riskAssessment!;
  triggered.push(`RISK_TIER_${assessment.tier}_${assessment.label.toUpperCase()}`);
  if (assessment.criteria.find((item) => item.key === "detection_confidence")!.score === 3)
    triggered.push("LOW_DETECTION_CONFIDENCE");
  if (recommended.delayDays > thresholds.delayDays) triggered.push("TRANSIT_TIME_GT_7_DAYS");
  if (recommended.fuelTonnes > thresholds.fuelTonnes) triggered.push("BUNKER_FUEL_GT_1000_TONNES");
  if (shipment.cargoValueUsd > thresholds.cargoValueUsd)
    triggered.push("CARGO_VALUE_AT_RISK_GT_1000000_USD");
  if (shipment.coldChain) triggered.push("COLD_CHAIN_HUMAN_APPROVAL");
  if (recommended.feasibility === "uncertain") triggered.push("CAPACITY_CONFIRMATION_REQUIRED");
  decision.policyRulesTriggered = [...new Set(triggered)];
  decision.overallStatus = assessment.behavior;
  decision.secondaryApprovalRequired = assessment.tier === 4;
  decision.approvalStepsCompleted = 0;
  return decision;
}
