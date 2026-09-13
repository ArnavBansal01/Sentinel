import { SEED_DISRUPTIONS } from "./seed";
import type { DisruptionEvent, EvidenceSource } from "./types";

/**
 * Sense-layer connector abstraction.
 *
 * Only seeded/demo connectors are wired in this version. Replacing one with a
 * real provider means implementing `Connector` and registering it below — no
 * other part of the workflow changes.
 */
export interface ConnectorResult {
  connector: EvidenceSource["connector"];
  sources: EvidenceSource[];
  live: boolean;
}

export interface Connector {
  name: EvidenceSource["connector"];
  live: boolean;
  fetchFor(shipmentId: string): ConnectorResult;
}

function seededConnector(name: EvidenceSource["connector"]): Connector {
  return {
    name,
    live: false,
    fetchFor(shipmentId) {
      const event = SEED_DISRUPTIONS[shipmentId];
      return {
        connector: name,
        live: false,
        sources: event ? event.sources.filter((s) => s.connector === name) : [],
      };
    },
  };
}

export const NewsConnector = seededConnector("NewsConnector");
export const WeatherConnector = seededConnector("WeatherConnector");
export const AISConnector = seededConnector("AISConnector");
export const PortConnector = seededConnector("PortConnector");

export const CONNECTORS: Connector[] = [NewsConnector, WeatherConnector, AISConnector, PortConnector];

/** Runs every registered connector and assembles the verified evidence chain. */
export function senseShipment(shipmentId: string): DisruptionEvent | null {
  const event = SEED_DISRUPTIONS[shipmentId];
  if (!event) return null;
  const sources = CONNECTORS.flatMap((c) => c.fetchFor(shipmentId).sources);
  const independent = new Set(sources.map((s) => s.connector));
  return {
    ...event,
    sources,
    // Verification rule: two independent non-AIS sources plus AIS confirmation.
    verified: independent.has("AISConnector") && independent.size >= 3,
  };
}
