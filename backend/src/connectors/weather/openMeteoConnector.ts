import { config } from "../../config.js";
import type { WeatherConnector, ConnectorResult } from "../interfaces.js";
import type { GeoPoint, Signal } from "../../types/domain.js";
export class OpenMeteoConnector implements WeatherConnector {
  constructor(private forceDemo = false) {}
  async getForecast(points: GeoPoint[]): Promise<ConnectorResult> {
    if (this.forceDemo || config.mode === "DEMO") return demo(points);
    try {
      const all: Signal[] = [];
      for (const p of points) {
        const u = new URL("https://api.open-meteo.com/v1/forecast");
        u.search = new URLSearchParams({
          latitude: String(p.lat),
          longitude: String(p.lon),
          current:
            "temperature_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m",
          hourly: "visibility",
          forecast_days: "1",
        }).toString();
        const r = await fetch(u, { signal: AbortSignal.timeout(config.providerTimeoutMs) });
        if (!r.ok) throw new Error(`status_${r.status}`);
        all.push(normalizeOpenMeteo((await r.json()) as Record<string, unknown>, p));
      }
      return { signals: all, provider: { provider: "Open-Meteo", status: "LIVE" } };
    } catch (e) {
      return {
        signals: [],
        provider: {
          provider: "Open-Meteo",
          status: "UNAVAILABLE",
          reason: e instanceof Error ? e.message : "network_failure",
        },
      };
    }
  }
}
export function normalizeOpenMeteo(j: Record<string, unknown>, p: GeoPoint): Signal {
  const c = (j["current"] ?? {}) as Record<string, unknown>;
  const wind = Number(c["wind_speed_10m"] ?? 0),
    gust = Number(c["wind_gusts_10m"] ?? 0),
    rain = Number(c["precipitation"] ?? 0);
  const confidence = gust > 70 || rain > 20 ? 0.9 : gust > 45 ? 0.72 : 0.35;
  return {
    id: `weather-${p.code}-${String(c["time"] ?? Date.now())}`,
    source: "Open-Meteo forecast",
    type: "WEATHER",
    timestamp: String(c["time"] ?? new Date().toISOString()),
    location: p.name,
    confidence,
    title: `Weather at ${p.name}: wind ${wind} km/h, gust ${gust} km/h`,
    description: `Precipitation ${rain} mm; temperature ${Number(c["temperature_2m"] ?? 0)} °C; pressure ${Number(c["surface_pressure"] ?? 0)} hPa.`,
    provider: "Open-Meteo",
    dataStatus: "LIVE",
    payload: {
      windSpeed: wind,
      windGust: gust,
      precipitation: rain,
      weatherCode: c["weather_code"],
    },
  };
}
function demo(points: GeoPoint[]): ConnectorResult {
  return {
    signals: points.map((p, i) => ({
      id: `demo-weather-${p.code}`,
      source: "Deterministic weather scenario",
      type: "WEATHER",
      timestamp: new Date().toISOString(),
      location: p.name,
      confidence: i ? 0.66 : 0.42,
      title: `Demo forecast for ${p.name}`,
      description: i
        ? "Elevated winds corroborate operating delays."
        : "Normal conditions at origin.",
      provider: "DemoWeatherConnector",
      dataStatus: "DEMO",
      payload: { windSpeed: i ? 48 : 18, windGust: i ? 70 : 28, precipitation: i ? 9 : 1 },
    })),
    provider: { provider: "DemoWeatherConnector", status: "DEMO" },
  };
}
