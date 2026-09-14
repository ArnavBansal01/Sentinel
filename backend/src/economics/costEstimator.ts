import { config } from "../config.js";
import { greatCircleDistanceNm } from "../routing/routeEngine.js";
import type {
  CostBreakdown,
  DecisionOption,
  DisruptionAssessment,
  OptionType,
  RoutePlan,
  Shipment,
} from "../types/domain.js";

const roundMoney = (value: number) => Math.max(0, Math.round(value / 100) * 100);
const roundOne = (value: number) => Math.max(0, Math.round(value * 10) / 10);

function voyageFuel(distanceNm: number, speedKnots: number): number {
  const sailingDays = distanceNm / speedKnots / 24;
  const dailyFuel =
    config.economics.baseFuelTonnesPerDay *
    Math.pow(speedKnots / config.routing.vesselSpeedKnots, 3);
  return sailingDays * dailyFuel;
}

function projectedRisk(shipment: Shipment, type: OptionType): number {
  const multiplier: Record<OptionType, [number, number]> = {
    reroute: [0.55, 0],
    respeed: [0.78, 8],
    port_switch: [0.6, 5],
    hold_and_wait: [0.7, 4],
    accept_loss: [0.95, 20],
  };
  const [factor, extra] = multiplier[type];
  const risk = shipment.riskScore * factor + extra;
  return Math.max(5, Math.min(95, Math.round(risk)));
}

function handlingCost(type: OptionType): number {
  if (type === "reroute") return config.economics.rerouteHandlingUsd;
  const rates: Record<OptionType, number> = {
    reroute: config.economics.rerouteHandlingUsd,
    respeed: config.economics.respeedHandlingUsd,
    port_switch: 38_000,
    hold_and_wait: 12_000,
    accept_loss: 0,
  };
  return rates[type];
}

function coldChainCost(shipment: Shipment, type: OptionType): number {
  if (!shipment.coldChain) return 0;
  const rate = type === "reroute" || type === "port_switch" ? 0.01 : 0.005;
  return shipment.cargoValueUsd * rate;
}

export function estimateRecoveryOption(
  shipment: Shipment,
  type: OptionType,
  route: RoutePlan,
): Pick<DecisionOption, "costUsd" | "delayDays" | "fuelTonnes" | "riskScore" | "costBreakdown"> {
  const baselineDistance = greatCircleDistanceNm(shipment.origin, shipment.destination);
  const baseFuel = voyageFuel(baselineDistance, config.routing.vesselSpeedKnots);
  const optionSpeed =
    type === "respeed" ? config.economics.respeedKnots : config.routing.vesselSpeedKnots;
  const optionFuel = voyageFuel(route.distanceNm, optionSpeed);
  const additionalFuel = roundOne(Math.max(0, optionFuel - baseFuel));
  const baselineDays = baselineDistance / config.routing.vesselSpeedKnots / 24;
  const optionDays = route.distanceNm / optionSpeed / 24;
  const operatingDays = Math.max(0, optionDays - baselineDays);
  const fixedDelay: Partial<Record<OptionType, number>> = {
    port_switch: 1.8,
    hold_and_wait: 4,
    accept_loss: 0,
  };
  const delayDays = roundOne(
    type === "respeed" ? 0 : route.etaDeltaDays + (fixedDelay[type] ?? 0.5),
  );
  const riskScore = projectedRisk(shipment, type);
  const modalPremium = type === "accept_loss" ? shipment.cargoValueUsd * 0.1 : 0;
  const breakdown: CostBreakdown = {
    bunkerFuelUsdPerTonne: config.economics.bunkerFuelUsdPerTonne,
    baselineFuelTonnes: roundOne(baseFuel),
    optionFuelTonnes: roundOne(optionFuel),
    fuelUsd: roundMoney(additionalFuel * config.economics.bunkerFuelUsdPerTonne),
    vesselTimeUsd: roundMoney(operatingDays * config.economics.vesselOperatingUsdPerDay),
    handlingUsd: roundMoney(handlingCost(type) + modalPremium),
    cargoProtectionUsd: roundMoney(coldChainCost(shipment, type)),
    riskReserveUsd: roundMoney(shipment.cargoValueUsd * (riskScore / 100) * 0.01),
    method: "route_cost_v1",
  };
  const costUsd = roundMoney(
    breakdown.fuelUsd +
      breakdown.vesselTimeUsd +
      breakdown.handlingUsd +
      breakdown.cargoProtectionUsd +
      breakdown.riskReserveUsd,
  );
  return { costUsd, delayDays, fuelTonnes: additionalFuel, riskScore, costBreakdown: breakdown };
}

export function estimateDoNothing(shipment: Shipment, disruption: DisruptionAssessment) {
  const delayDays = Math.max(4, Math.min(12, Math.round(3 + shipment.riskScore / 10)));
  const disruptionWeight = Math.max(0.35, disruption.confidence);
  const vesselTimeUsd = roundMoney(delayDays * config.economics.vesselOperatingUsdPerDay);
  const cargoExposureUsd = roundMoney(
    shipment.cargoValueUsd * (0.02 + (shipment.riskScore / 100) * 0.08) * disruptionWeight,
  );
  const coldChainExposureUsd = shipment.coldChain
    ? roundMoney(shipment.cargoValueUsd * 0.05 * disruptionWeight)
    : 0;
  const costUsd = roundMoney(vesselTimeUsd + cargoExposureUsd + coldChainExposureUsd);
  const riskScore = Math.max(
    50,
    Math.min(96, Math.round(shipment.riskScore + disruption.severity * 0.42)),
  );
  return {
    costUsd,
    delayDays,
    fuelTonnes: 0,
    riskScore,
    reason: `Estimated exposure includes ${delayDays} days of vessel time, cargo risk, and ${shipment.coldChain ? "cold-chain exposure" : "service-failure exposure"}.`,
    costBreakdown: {
      bunkerFuelUsdPerTonne: config.economics.bunkerFuelUsdPerTonne,
      baselineFuelTonnes: 0,
      optionFuelTonnes: 0,
      fuelUsd: 0,
      vesselTimeUsd,
      handlingUsd: 0,
      cargoProtectionUsd: coldChainExposureUsd,
      riskReserveUsd: cargoExposureUsd,
      method: "route_cost_v1" as const,
    },
  };
}

export function optionValueScore(option: DecisionOption): number {
  return option.costUsd + option.delayDays * 5_000 + option.riskScore * 1_000;
}
