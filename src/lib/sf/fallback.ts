import type { DraftDecision } from "./rules";
import type { Shipment } from "./types";

/**
 * Deterministic authoritative decision drafts.
 * Used when the model is unavailable, slow, malformed, or unsafe.
 * Fallback flows through exactly the same normalization + rule pipeline.
 */

const SF_1001: DraftDecision = {
  rationale:
    "Berth slippage at Rotterdam is verified by two independent sources plus AIS. A modest speed increase recovers the contractual window at the lowest total cost and without engaging any hard constraint.",
  constraint_analysis: [
    "No temperature-controlled cargo on this shipment — cold-chain rules not engaged.",
    "Contractual delivery window retains 5 days of float; all options stay inside it.",
  ],
  do_nothing: {
    cost_usd: 46000,
    days_added: 3.1,
    risk_score: 64,
    description:
      "Hold the schedule and absorb berth slippage: detention, demurrage and downstream distribution penalties.",
  },
  recommended_option_id: "SF-1001-respeed",
  options: [
    {
      id: "SF-1001-reroute",
      type: "reroute",
      label: "Reroute — discharge at Zeebrugge, feeder to Rotterdam",
      description: "Avoids the affected terminal; adds a short feeder leg and inland drayage.",
      cost_usd: 24500,
      days_added: 1.5,
      fuel_pct: 3.1,
      fuel_tonnes: 42,
      risk_score: 30,
      breaksColdChain: false,
    },
    {
      id: "SF-1001-respeed",
      type: "respeed",
      label: "Re-speed +1.2 kn on the approach leg",
      description: "Arrives ahead of the queue rebuild and holds the original berth window.",
      cost_usd: 18200,
      days_added: 0,
      fuel_pct: 6.4,
      fuel_tonnes: 88,
      risk_score: 26,
      breaksColdChain: false,
    },
    {
      id: "SF-1001-switch",
      type: "switch_mode",
      label: "Switch discharge port to Antwerp + barge",
      description: "Moves the call to an unaffected port with barge transfer to the Rotterdam hinterland.",
      cost_usd: 31400,
      days_added: 0.5,
      fuel_pct: 2.2,
      fuel_tonnes: 30,
      risk_score: 34,
      breaksColdChain: false,
    },
  ],
};

const SF_1002: DraftDecision = {
  rationale:
    "Southbound convoys are suspended for an estimated 72 hours. The cheapest recovery transhipments the reefer boxes through a yard with no certified reefer plugs, which breaks continuous 2–8 °C custody. It is refused. The Cape routing maintains unbroken reefer power on the same hull and is the cheapest viable recovery.",
  constraint_analysis: [
    "COLD CHAIN active: continuous 2–8 °C reefer custody is a hard constraint on every leg.",
    "Committed option keeps the cargo on the original hull under continuous reefer power — no new custody handover.",
  ],
  do_nothing: {
    cost_usd: 410000,
    days_added: 5.5,
    risk_score: 88,
    description:
      "Wait for the convoy to reopen: projected temperature excursion beyond tolerance and probable batch write-off.",
  },
  recommended_option_id: "SF-1002-reroute",
  options: [
    {
      id: "SF-1002-switch",
      type: "switch_mode",
      label: "Switch mode — tranship at Djibouti to regional feeder",
      description: "Cheapest recovery on paper: discharge, yard-stage and re-load onto a regional feeder.",
      cost_usd: 58000,
      days_added: 2.0,
      fuel_pct: 1.4,
      fuel_tonnes: 19,
      risk_score: 72,
      breaksColdChain: true,
      introducesColdChainLeg: true,
      refusalHint:
        "Cold-chain constraint violated: the Djibouti transhipment yard reports zero GDP-certified reefer plugs for 96 hours, so the boxes would stage ambient and break 2–8 °C custody.",
    },
    {
      id: "SF-1002-reroute",
      type: "reroute",
      label: "Reroute — Cape of Good Hope, continuous reefer power",
      description: "Longer ocean leg on the same hull; reefer plugs powered throughout, no handover.",
      cost_usd: 96500,
      days_added: 6.0,
      fuel_pct: 12.4,
      fuel_tonnes: 610,
      risk_score: 34,
      breaksColdChain: false,
    },
    {
      id: "SF-1002-respeed",
      type: "respeed",
      label: "Hold at anchorage, then re-speed +2.4 kn on reopening",
      description: "Retains the canal routing but burns heavily to recover the lost window after reopening.",
      cost_usd: 132000,
      days_added: 3.2,
      fuel_pct: 18.1,
      fuel_tonnes: 880,
      risk_score: 49,
      breaksColdChain: false,
    },
  ],
};

const SF_1003: DraftDecision = {
  rationale:
    "The forecast system intersects the planned track within 30 hours. A southern reroute clears the worst of the field at the lowest cost while keeping the Los Angeles berth window, but the cargo value at risk places the decision above the autonomous threshold.",
  constraint_analysis: [
    "Regulated substance: customs pre-clearance is filed against the Los Angeles call — a port switch would require refiling.",
    "No temperature-controlled leg on this shipment — cold-chain rules not engaged.",
  ],
  do_nothing: {
    cost_usd: 392000,
    days_added: 4.4,
    risk_score: 71,
    description:
      "Transit the system as planned: heavy-weather delay, cargo-securing risk and a missed berth window with demurrage.",
  },
  recommended_option_id: "SF-1003-reroute",
  options: [
    {
      id: "SF-1003-reroute",
      type: "reroute",
      label: "Reroute — southern great-circle deviation",
      description: "Routes 320 nm south of the system core and rejoins the track before approach.",
      cost_usd: 128000,
      days_added: 2.2,
      fuel_pct: 5.6,
      fuel_tonnes: 240,
      risk_score: 31,
      breaksColdChain: false,
    },
    {
      id: "SF-1003-respeed",
      type: "respeed",
      label: "Re-speed +2.0 kn to pass ahead of the system",
      description: "Crosses the forecast track before the system arrives; high bunker consumption.",
      cost_usd: 176000,
      days_added: 0.8,
      fuel_pct: 11.2,
      fuel_tonnes: 505,
      risk_score: 44,
      breaksColdChain: false,
    },
    {
      id: "SF-1003-switch",
      type: "switch_mode",
      label: "Switch discharge port to Oakland + rail to LA basin",
      description: "Discharges north of the affected approach and rails the boxes south.",
      cost_usd: 214000,
      days_added: 1.4,
      fuel_pct: 3.4,
      fuel_tonnes: 148,
      risk_score: 38,
      breaksColdChain: false,
    },
  ],
};

const SCENARIOS: Record<string, DraftDecision> = {
  "SF-1001": SF_1001,
  "SF-1002": SF_1002,
  "SF-1003": SF_1003,
};

/** Deterministic draft for any shipment (scenario data where available). */
export function fallbackDraft(shipment: Shipment): DraftDecision {
  const scenario = SCENARIOS[shipment.id];
  if (scenario) return structuredClone(scenario);

  const base = Math.round(shipment.cargoValueUsd * 0.06);
  const draft: DraftDecision = {
    rationale:
      "Deterministic recovery envelope derived from seeded lane economics for a non-scenario shipment.",
    constraint_analysis: shipment.coldChain
      ? ["COLD CHAIN active: continuous temperature custody enforced on every option."]
      : ["No temperature-controlled cargo — cold-chain rules not engaged."],
    do_nothing: {
      cost_usd: Math.round(base * 2.4),
      days_added: 3,
      risk_score: Math.min(95, shipment.riskScore + 25),
      description: "Absorb the delay and its downstream penalties.",
    },
    recommended_option_id: `${shipment.id}-reroute`,
    options: [
      {
        id: `${shipment.id}-reroute`,
        type: "reroute",
        label: "Reroute via alternate call",
        description: "Alternate port rotation avoiding the affected node.",
        cost_usd: base,
        days_added: 1.8,
        fuel_pct: 4.2,
        fuel_tonnes: Math.round(base / 600),
        risk_score: Math.max(10, shipment.riskScore - 10),
        breaksColdChain: false,
      },
      {
        id: `${shipment.id}-respeed`,
        type: "respeed",
        label: "Re-speed to recover the window",
        description: "Increase service speed on the remaining leg.",
        cost_usd: Math.round(base * 1.35),
        days_added: 0.6,
        fuel_pct: 9.1,
        fuel_tonnes: Math.round(base / 380),
        risk_score: Math.max(12, shipment.riskScore - 4),
        breaksColdChain: false,
      },
      {
        id: `${shipment.id}-switch`,
        type: "switch_mode",
        label: "Switch mode / discharge port",
        description: "Alternate discharge with inland leg to the original destination.",
        cost_usd: Math.round(base * 1.7),
        days_added: 1.1,
        fuel_pct: 2.8,
        fuel_tonnes: Math.round(base / 900),
        risk_score: Math.max(14, shipment.riskScore - 6),
        breaksColdChain: shipment.coldChain,
        introducesColdChainLeg: shipment.coldChain,
      },
    ],
  };
  return draft;
}
