import type { DisruptionAssessment, OptionType, Shipment } from "../types/domain.js";

export const RECOVERY_LABELS: Record<OptionType, string> = {
  reroute: "Reroute vessel",
  respeed: "Adjust sailing speed",
  switch_mode: "Move urgent cargo to air",
  port_switch: "Divert to another port",
  split_shipment: "Split cargo across two paths",
  hold_and_wait: "Hold in a bonded warehouse",
  accept_loss: "Stop delivery and file a claim",
};

export const RECOVERY_DESCRIPTIONS: Record<OptionType, string> = {
  reroute: "Avoid the disrupted corridor using validated alternate waypoints.",
  respeed: "Adjust speed on safe legs to recover time without changing the route.",
  switch_mode: "Move time-critical cargo to air for the longest practical leg.",
  port_switch: "Divert to a feasible nearby port and complete the journey inland.",
  split_shipment: "Send urgent units on a faster path while the remainder stays on sea.",
  hold_and_wait: "Store cargo securely near the corridor until the short disruption clears.",
  accept_loss: "Abandon physical recovery when delivery is no longer economically viable.",
};

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.toLowerCase().includes(term));

function cargoValuePerKg(shipment: Shipment): number | null {
  if (!shipment.quantity || shipment.quantity <= 0) return null;
  if (shipment.quantityUnit === "kg") return shipment.cargoValueUsd / shipment.quantity;
  if (shipment.quantityUnit === "tonnes")
    return shipment.cargoValueUsd / (shipment.quantity * 1_000);
  return null;
}

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
  add("respeed", shipment.coldChain ? -30 : 18);
  add("port_switch", 12);
  add("split_shipment", 10);
  add("switch_mode", 8);

  if (includesAny(context, ["port", "congestion", "berth", "customs"])) {
    add("port_switch", 65);
  }
  if (includesAny(context, ["suez", "canal", "closure", "route", "corridor"])) add("reroute", 55);
  if (includesAny(context, ["mechanical", "carrier", "vessel", "breakdown"])) add("reroute", 20);
  if (includesAny(context, ["hormuz", "red sea", "war", "conflict", "piracy", "contested"]))
    add("reroute", 35);

  const highValueDensity = (cargoValuePerKg(shipment) ?? 0) >= 40;
  if (
    highValueDensity ||
    shipment.priority === "critical" ||
    includesAny(shipment.cargo, ["pharma", "medicine", "vaccine", "electronic"])
  ) {
    add("switch_mode", 52);
    add("split_shipment", 48);
  }
  if (
    !shipment.coldChain &&
    shipment.priority !== "critical" &&
    !includesAny(shipment.cargo, ["food", "dairy", "vaccine", "medicine"])
  ) {
    add("hold_and_wait", disruption.severity < 75 ? 46 : 12);
  }
  if (shipment.priority === "critical" || shipment.cargoValueUsd >= 500_000)
    add("split_shipment", 28);
  if (shipment.cargoValueUsd < 100_000 && shipment.riskScore >= 70) add("accept_loss", 45);

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([type]) => type);
}

export function optionFeasibility(type: OptionType): "confirmed" | "uncertain" | "unavailable" {
  return ["switch_mode", "port_switch", "split_shipment"].includes(type)
    ? "uncertain"
    : "confirmed";
}
