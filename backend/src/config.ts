import "dotenv/config";

function positiveEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  mode: (process.env["NODE_ENV"] !== "test" &&
  process.env["SENTINEL_MODE"]?.toLowerCase() === "live"
    ? "LIVE"
    : "DEMO") as "LIVE" | "DEMO",
  port: Number(process.env["BACKEND_PORT"] ?? 8787),
  confidence: {
    news: 0.55,
    weather: 0.72,
    ais: 0.88,
    port: 0.92,
    corroborationBonus: 0.08,
    trigger: 0.62,
  },
  routing: { vesselSpeedKnots: 16, fuelTonnesPerNm: 0.045 },
  economics: {
    bunkerFuelUsdPerTonne: positiveEnv("BUNKER_FUEL_USD_PER_TONNE", 635),
    vesselOperatingUsdPerDay: positiveEnv("VESSEL_OPERATING_USD_PER_DAY", 25_000),
    baseFuelTonnesPerDay: positiveEnv("BASE_FUEL_TONNES_PER_DAY", 45),
    respeedKnots: positiveEnv("RESPEED_KNOTS", 18.5),
    rerouteHandlingUsd: positiveEnv("REROUTE_HANDLING_USD", 15_000),
    respeedHandlingUsd: positiveEnv("RESPEED_HANDLING_USD", 5_000),
    modeSwitchHandlingUsd: positiveEnv("MODE_SWITCH_HANDLING_USD", 45_000),
  },
  providerTimeoutMs: 12_000,
};
