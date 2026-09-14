import type { DisruptionAssessment, OptionType, Shipment } from "../types/domain.js";

export const RECOVERY_LABELS: Record<OptionType, string> = {
  reroute: "Reroute vessel",
  respeed: "Adjust sailing speed",
  port_switch: "Divert to another port",
  hold_and_wait: "Hold in a bonded warehouse",
  accept_loss: "Stop delivery and file a claim",
};

export const RECOVERY_DESCRIPTIONS: Record<OptionType, string> = {
  reroute: "Avoid the disrupted corridor using validated alternate waypoints.",
  respeed: "Adjust speed on safe legs to recover time without changing the route.",
  port_switch: "Divert to a feasible nearby port and complete the journey inland.",
  hold_and_wait: "Store cargo securely near the corridor until the short disruption clears.",
  accept_loss: "Abandon physical recovery when delivery is no longer economically viable.",
};

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.toLowerCase().includes(term));

/** Deterministic scenario filter: the model may explain options, but cannot invent the candidate set. */
export function selectApplicableRecoveryTypes(
  shipment: Shipment,
  disruption: DisruptionAssessment,
  limit = 3,
): OptionType[] {
  const context = [
    disruption.type,
    disruption.location,
    disruption.explanation,
    shipment.origin.name,
    shipment.destination.name,
    shipment.constraints.join(" "),
  ].join(" ");
  const scores = new Map<OptionType, number>();
  const add = (type: OptionType, score: number) =>
    scores.set(type, (scores.get(type) ?? 0) + score);

  add("reroute", 35);
  add("respeed", 18);
  add("port_switch", 12);

  if (includesAny(context, ["port", "congestion", "berth", "customs"])) {
    add("port_switch", 65);
  }
  if (includesAny(context, ["suez", "canal", "closure", "route", "corridor"])) add("reroute", 55);
  if (includesAny(context, ["mechanical", "carrier", "vessel", "breakdown"])) add("reroute", 20);
  if (includesAny(context, ["hormuz", "red sea", "war", "conflict", "piracy", "contested"]))
    add("reroute", 35);

  if (
    !shipment.coldChain &&
    shipment.priority !== "critical" &&
    !includesAny(shipment.cargo, ["food", "dairy", "vaccine", "medicine"])
  ) {
    add("hold_and_wait", disruption.severity < 75 ? 46 : 12);
  }
  if (shipment.cargoValueUsd < 100_000 && shipment.riskScore >= 70) add("accept_loss", 45);

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([type]) => type);
}

export function optionFeasibility(type: OptionType): "confirmed" | "uncertain" | "unavailable" {
  return type === "port_switch" ? "uncertain" : "confirmed";
}
