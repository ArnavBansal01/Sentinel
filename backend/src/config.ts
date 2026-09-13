import "dotenv/config";

export const config = {
  mode: (process.env["NODE_ENV"] !== "test" && process.env["SENTINEL_MODE"]?.toLowerCase() === "live" ? "LIVE" : "DEMO") as
    "LIVE" | "DEMO",
  port: Number(process.env["BACKEND_PORT"] ?? 8787),
  confidence: {
    news: 0.55,
    weather: 0.72,
    ais: 0.88,
    port: 0.92,
    corroborationBonus: 0.08,
    trigger: 0.62,
  },
  routing: { vesselSpeedKnots: 16, fuelTonnesPerNm: 0.045, costPerFuelTonne: 680 },
  providerTimeoutMs: 12_000,
};
