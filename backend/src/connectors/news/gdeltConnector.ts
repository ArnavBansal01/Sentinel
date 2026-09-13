import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import type { NewsConnector, ConnectorResult } from "../interfaces.js";
import type { Shipment, Signal } from "../../types/domain.js";
export class GdeltConnector implements NewsConnector {
  constructor(private forceDemo = false) {}
  async search(s: Shipment): Promise<ConnectorResult> {
    if (this.forceDemo || config.mode === "DEMO") return demo(s);
    const query = `(${s.origin.name} OR ${s.destination.name} OR ${s.vessel}) (port OR shipping OR congestion OR disruption OR strike OR storm)`;
    try {
      const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      u.search = new URLSearchParams({
        query,
        mode: "artlist",
        maxrecords: "20",
        format: "json",
        sort: "datedesc",
      }).toString();
      const r = await fetch(u, { signal: AbortSignal.timeout(config.providerTimeoutMs) });
      if (!r.ok) throw new Error(`status_${r.status}`);
      const j = (await r.json()) as { articles?: Array<Record<string, unknown>> };
      const signals = (j.articles ?? []).map((a) => normalizeGdeltArticle(a, s.destination.name));
      return { signals, provider: { provider: "GDELT", status: "LIVE" } };
    } catch (e) {
      return {
        signals: [],
        provider: {
          provider: "GDELT",
          status: "UNAVAILABLE",
          reason: e instanceof Error ? e.message : "network_failure",
        },
      };
    }
  }
}
export function normalizeGdeltArticle(a: Record<string, unknown>, location: string): Signal {
  return {
    id: String(a["url"] ?? randomUUID()),
    source: String(a["domain"] ?? "GDELT"),
    type: "NEWS",
    timestamp: parseDate(String(a["seendate"] ?? "")),
    location,
    confidence: 0.58,
    title: String(a["title"] ?? "Untitled report"),
    description: String(a["title"] ?? "GDELT report"),
    url: String(a["url"] ?? ""),
    provider: "GDELT",
    dataStatus: "LIVE",
  };
}
function parseDate(v: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m
    ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString()
    : new Date().toISOString();
}
function demo(s: Shipment): ConnectorResult {
  const location = s.id === "SF-1002" ? "Suez Canal" : s.destination.name;
  return {
    signals: [
      {
        id: `demo-news-${s.id}`,
        source: "Sentinel deterministic scenario",
        type: "NEWS",
        timestamp: new Date().toISOString(),
        location,
        confidence: 0.78,
        title:
          s.id === "SF-1001"
            ? "Rotterdam berth queues extended"
            : s.id === "SF-1002"
              ? "Suez transit delays reported"
              : "Pacific terminal congestion increasing",
        description: "Deterministic demo evidence; not a live report.",
        provider: "DemoNewsConnector",
        dataStatus: "DEMO",
      },
    ],
    provider: { provider: "DemoNewsConnector", status: "DEMO" },
  };
}
