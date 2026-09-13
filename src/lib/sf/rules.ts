import type {
  Decision,
  DecisionSource,
  DoNothingBaseline,
  RecoveryOption,
  Shipment,
} from "./types";

/**
 * Hard business rules. These are enforced deterministically by the application.
 * The model never controls them.
 */
export const APPROVAL_THRESHOLDS = {
  cargoValueUsd: 1_000_000,
  daysAdded: 7,
  bunkerTonnes: 1_000,
} as const;

export interface DraftOption extends Omit<RecoveryOption, "status" | "refusal_reason" | "constraint"> {
  /** True when the option breaks continuous temperature-controlled custody. */
  breaksColdChain: boolean;
  /** True when the option introduces a new cold-chain custody handover. */
  introducesColdChainLeg?: boolean;
  /** Constraint-specific refusal text used when the option is refused. */
  refusalHint?: string;
}

export interface DraftDecision {
  options: DraftOption[];
  do_nothing: DoNothingBaseline;
  recommended_option_id?: string | null;
  rationale: string;
  constraint_analysis: string[];
}

export interface NormalizedDecisionInput {
  shipment: Shipment;
  draft: DraftDecision;
  requestId: string;
  source: DecisionSource;
  sourceNote?: string;
  nowIso: string;
}

/** Rule A — a cold-chain shipment may never commit an option that breaks the cold chain. */
export function applyColdChainRefusals(shipment: Shipment, options: DraftOption[]): RecoveryOption[] {
  return options.map((o) => {
    if (shipment.coldChain && o.breaksColdChain) {
      return {
        ...stripDraft(o),
        status: "refused" as const,
        constraint: "COLD CHAIN",
        refusal_reason:
          o.refusalHint ??
          "Cold-chain constraint violated: continuous 2–8 °C reefer custody cannot be guaranteed on this option.",
      };
    }
    return { ...stripDraft(o), status: "viable" as const };
  });
}

function stripDraft(o: DraftOption): Omit<RecoveryOption, "status"> {
  const { breaksColdChain, introducesColdChainLeg, refusalHint, ...clean } = o;
  void breaksColdChain;
  void introducesColdChainLeg;
  void refusalHint;
  return clean;
}

/** Rule B — thresholds that force a human into the loop. */
export function approvalReasons(shipment: Shipment, option: RecoveryOption | null, draft: DraftOption[]): string[] {
  const reasons: string[] = [];
  if (shipment.cargoValueUsd > APPROVAL_THRESHOLDS.cargoValueUsd) {
    reasons.push(
      `Cargo value at risk (${formatUsd(shipment.cargoValueUsd)}) exceeds the autonomous approval threshold of ${formatUsd(APPROVAL_THRESHOLDS.cargoValueUsd)}.`,
    );
  }
  if (option) {
    if (option.days_added > APPROVAL_THRESHOLDS.daysAdded) {
      reasons.push(
        `Added transit time (${option.days_added} days) exceeds the ${APPROVAL_THRESHOLDS.daysAdded}-day autonomous limit.`,
      );
    }
    if (option.fuel_tonnes > APPROVAL_THRESHOLDS.bunkerTonnes) {
      reasons.push(
        `Extra bunker fuel (${Math.round(option.fuel_tonnes)} t) exceeds the ${APPROVAL_THRESHOLDS.bunkerTonnes} t autonomous limit.`,
      );
    }
    const source = draft.find((d) => d.id === option.id);
    if (shipment.coldChain && source?.introducesColdChainLeg) {
      reasons.push("Option introduces a new cold-chain custody handover; human approval required.");
    }
  }
  return reasons;
}

function formatUsd(v: number): string {
  return `$${v.toLocaleString("en-US")}`;
}

/**
 * Normalizes any decision draft (model-generated or deterministic fallback)
 * into the authoritative decision object used by the workflow state machine.
 * Rules C and D are applied here: the cheapest VIABLE option wins, refused
 * options can never be committed, and thresholds force PENDING_APPROVAL.
 */
export function normalizeDecision(input: NormalizedDecisionInput): Decision {
  const { shipment, draft, requestId, source, nowIso } = input;
  const options = applyColdChainRefusals(shipment, draft.options);
  const viable = options.filter((o) => o.status === "viable");

  // Rule D: a recommendation that violates a hard constraint is never committed.
  const cheapestViable =
    viable.length > 0 ? viable.reduce((a, b) => (b.cost_usd < a.cost_usd ? b : a)) : null;

  let recommended = cheapestViable;
  const hinted = options.find((o) => o.id === draft.recommended_option_id);
  if (hinted && hinted.status === "viable" && cheapestViable && hinted.cost_usd <= cheapestViable.cost_usd) {
    recommended = hinted;
  }

  // Do Nothing is the baseline: recovery must beat the modelled cost of inaction.
  const beatsInaction = recommended ? recommended.cost_usd < draft.do_nothing.cost_usd : false;

  const reasons = approvalReasons(shipment, recommended, draft.options);
  const refusals = options
    .filter((o) => o.status === "refused")
    .map((o) => ({
      optionId: o.id,
      reason: o.refusal_reason ?? "Refused by hard constraint.",
      constraint: o.constraint ?? "HARD CONSTRAINT",
    }));

  let overall_status: Decision["overall_status"];
  let committed: string | null = null;

  if (!recommended || !beatsInaction) {
    overall_status = "AUTO_COMMITTED";
    committed = null; // Do Nothing retained
  } else if (reasons.length > 0) {
    overall_status = "PENDING_APPROVAL";
  } else {
    overall_status = "AUTO_COMMITTED";
    committed = recommended.id;
  }

  const constraint_analysis = [...draft.constraint_analysis];
  if (refusals.length > 0) {
    constraint_analysis.unshift(
      `${refusals.length} option(s) refused by hard constraint enforcement before commit evaluation.`,
    );
  }
  if (reasons.length === 0 && overall_status === "AUTO_COMMITTED") {
    constraint_analysis.push("No human-approval threshold breached — autonomous commit permitted.");
  }

  return {
    id: `DEC-${shipment.id}-${requestId.slice(0, 8).toUpperCase()}`,
    requestId,
    shipmentId: shipment.id,
    generatedAtIso: nowIso,
    source,
    ...(input.sourceNote ? { sourceNote: input.sourceNote } : {}),
    options,
    do_nothing: draft.do_nothing,
    recommended_option_id: recommended?.id ?? null,
    committed_option_id: committed,
    overall_status,
    rationale: draft.rationale,
    constraint_analysis,
    approval_reasons: reasons,
    refusals,
  };
}
