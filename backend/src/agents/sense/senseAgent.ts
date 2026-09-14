import { randomUUID } from "node:crypto";
import { GdeltConnector } from "../../connectors/news/gdeltConnector.js";
import { OpenMeteoConnector } from "../../connectors/weather/openMeteoConnector.js";
import { AisStreamConnector } from "../../connectors/ais/aisStreamConnector.js";
import { PortcastConnector } from "../../connectors/ports/portcastConnector.js";
import { calculateConfidence } from "./confidence.js";
import { publish } from "../../events/eventBus.js";
import type { Shipment, DisruptionAssessment, Signal } from "../../types/domain.js";
export class SenseAgent {
  constructor(
    private news = new GdeltConnector(),
    private weather = new OpenMeteoConnector(),
    private ais = new AisStreamConnector(),
    private port = new PortcastConnector(),
  ) {}
  static demo() {
    return new SenseAgent(
      new GdeltConnector(true),
      new OpenMeteoConnector(true),
      new AisStreamConnector(true),
      new PortcastConnector(true),
    );
  }
  static prototypeControl(shipment: Shipment, traceId: string): DisruptionAssessment {
    publish(traceId, "sense", "sense.started", shipment.id, "Prototype control check started");
    const assessment: DisruptionAssessment = {
      eventId: randomUUID(),
      shipmentId: shipment.id,
      type: "ROUTE_DISRUPTION",
      severity: 0,
      confidence: 0,
      location: shipment.destination.name,
      detectedAt: new Date().toISOString(),
      exists: false,
      explanation:
        "Prototype control route: no disruption was injected for SF-2043, so the decision and action stages are skipped.",
      affectedSegments: [],
      evidence: [],
      providers: [
        {
          provider: "Sentinel prototype scenario",
          status: "DEMO",
          reason: "SF-2043 is the no-disruption control shipment.",
        },
      ],
    };
    publish(traceId, "sense", "sense.signal_correlated", shipment.id, assessment.explanation, {
      confidence: 0,
      prototypeControl: true,
    });
    return assessment;
  }
  async run(shipment: Shipment, traceId: string): Promise<DisruptionAssessment> {
    publish(traceId, "sense", "sense.started", shipment.id, "Evidence collection started");
    const results = await Promise.all([
      this.news.search(shipment),
      this.weather.getForecast([shipment.origin, shipment.destination]),
      this.ais.getRecentVessels(shipment),
      this.port.getCongestion(shipment.destination),
    ]);
    const dedup = new Map<string, Signal>();
    for (const r of results)
      for (const s of r.signals) {
        dedup.set(`${s.type}:${s.url ?? s.title}`.toLowerCase(), s);
        publish(
          traceId,
          "sense",
          "sense.signal_received",
          shipment.id,
          `${s.dataStatus} ${s.type}: ${s.title}`,
          s,
        );
      }
    const evidence = [...dedup.values()];
    const c = calculateConfidence(evidence);
    publish(traceId, "sense", "sense.signal_correlated", shipment.id, c.explanation, {
      confidence: c.score,
    });
    const assessment: DisruptionAssessment = {
      eventId: randomUUID(),
      shipmentId: shipment.id,
      type: evidence.some((e) => e.type === "PORT") ? "PORT_CONGESTION" : "ROUTE_DISRUPTION",
      severity: Math.round(c.score * 100),
      confidence: c.score,
      location: shipment.id === "SF-1002" ? "Suez Canal" : shipment.destination.name,
      detectedAt: new Date().toISOString(),
      exists: c.exists,
      explanation: c.explanation,
      affectedSegments: [
        `${shipment.position.lat},${shipment.position.lon} → ${shipment.destination.name}`,
      ],
      evidence,
      providers: results.map((r) => r.provider),
    };
    if (c.exists)
      publish(
        traceId,
        "sense",
        "sense.disruption_detected",
        shipment.id,
        `Disruption detected at ${assessment.location} (${assessment.severity}/100)`,
        assessment,
      );
    return assessment;
  }
}
