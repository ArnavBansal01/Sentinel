import { config } from "../../config.js";
import type { AISConnector, ConnectorResult } from "../interfaces.js";
import type { Shipment } from "../../types/domain.js";
export const aisRuntimeStatus: {
  status: "ready" | "connecting" | "connected" | "idle" | "unavailable";
  lastConnectedAt?: string;
  lastMessageAt?: string;
  lastCollectionCount: number;
  lastError?: string;
} = {
  status: process.env["AISSTREAM_API_KEY"] ? "ready" : "unavailable",
  lastCollectionCount: 0,
};
export function normalizeAisMessage(j: Record<string, unknown>) {
  const meta = (j["MetaData"] ?? {}) as Record<string, unknown>;
  const msg = (j["Message"] ?? {}) as Record<string, unknown>;
  const pos = (msg["PositionReport"] ?? {}) as Record<string, unknown>;
  return {
    mmsi: String(meta["MMSI"] ?? ""),
    shipName: String(meta["ShipName"] ?? "Unknown"),
    latitude: Number(pos["Latitude"] ?? meta["latitude"] ?? 0),
    longitude: Number(pos["Longitude"] ?? meta["longitude"] ?? 0),
    sog: Number(pos["Sog"] ?? 0),
    cog: Number(pos["Cog"] ?? 0),
    heading: Number(pos["TrueHeading"] ?? 0),
    timestamp: String(meta["time_utc"] ?? new Date().toISOString()),
  };
}
export class AisStreamConnector implements AISConnector {
  constructor(private forceDemo = false) {}
  async getRecentVessels(s: Shipment): Promise<ConnectorResult> {
    if (this.forceDemo || config.mode === "DEMO")
      return {
        signals: [
          {
            id: `demo-ais-${s.id}`,
            source: "Deterministic AIS scenario",
            type: "AIS",
            timestamp: new Date().toISOString(),
            location: s.destination.name,
            confidence: 0.87,
            title: `14 vessels in approach queue near ${s.destination.name}`,
            description: "Deterministic demo AIS aggregate; not a live vessel position.",
            provider: "DemoAISConnector",
            dataStatus: "DEMO",
            payload: { vesselCount: 14 },
          },
        ],
        provider: { provider: "DemoAISConnector", status: "DEMO" },
      };
    if (!process.env["AISSTREAM_API_KEY"])
      return {
        signals: [],
        provider: { provider: "AISStream", status: "UNAVAILABLE", reason: "missing_api_key" },
      };
    aisRuntimeStatus.status = "connecting";
    delete aisRuntimeStatus.lastError;
    return this.collect(s);
  }
  private collect(s: Shipment): Promise<ConnectorResult> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (r: ConnectorResult) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          ws.close();
        } catch {
          // Socket may already be closed after a provider failure.
        }
        aisRuntimeStatus.lastCollectionCount = r.signals.length;
        aisRuntimeStatus.status = r.provider.status === "LIVE" ? "idle" : "unavailable";
        if (r.provider.reason) aisRuntimeStatus.lastError = r.provider.reason;
        else delete aisRuntimeStatus.lastError;
        resolve(r);
      };
      const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
      const signals: ConnectorResult["signals"] = [];
      let attempts = 0;
      ws.onopen = () => {
        attempts++;
        aisRuntimeStatus.status = "connected";
        aisRuntimeStatus.lastConnectedAt = new Date().toISOString();
        const d = s.destination;
        ws.send(
          JSON.stringify({
            APIKey: process.env["AISSTREAM_API_KEY"],
            BoundingBoxes: [
              [
                [d.lat - 2, d.lon - 2],
                [d.lat + 2, d.lon + 2],
              ],
            ],
            FilterMessageTypes: ["PositionReport", "ShipStaticData"],
          }),
        );
      };
      ws.onmessage = (e) => {
        try {
          const p = normalizeAisMessage(JSON.parse(String(e.data)) as Record<string, unknown>);
          if (Date.now() - Date.parse(p.timestamp) > 3600000) return;
          signals.push({
            id: `ais-${p.mmsi}-${p.timestamp}`,
            source: p.shipName,
            type: "AIS",
            timestamp: p.timestamp,
            location: s.destination.name,
            confidence: 0.88,
            title: `${p.shipName} at ${p.sog} kn`,
            description: `MMSI ${p.mmsi}; course ${p.cog}°`,
            provider: "AISStream",
            dataStatus: "LIVE",
            payload: p,
          });
          aisRuntimeStatus.lastMessageAt = p.timestamp;
          if (signals.length >= 20)
            finish({ signals, provider: { provider: "AISStream", status: "LIVE" } });
        } catch {
          // Ignore malformed provider messages; validated messages remain usable.
        }
      };
      ws.onerror = () =>
        finish({
          signals: [],
          provider: {
            provider: "AISStream",
            status: "UNAVAILABLE",
            reason: `connection_failed_attempt_${attempts}`,
          },
        });
      const timer = setTimeout(
        () =>
          finish(
            signals.length
              ? { signals, provider: { provider: "AISStream", status: "LIVE" } }
              : {
                  signals: [],
                  provider: {
                    provider: "AISStream",
                    status: "UNAVAILABLE",
                    reason: "collection_timeout",
                  },
                },
          ),
        5000,
      );
    });
  }
}
