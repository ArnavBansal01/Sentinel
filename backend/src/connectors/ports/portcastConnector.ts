import { config } from "../../config.js";
import type { PortConnector, ConnectorResult } from "../interfaces.js";
import type { GeoPoint } from "../../types/domain.js";
export class PortcastConnector implements PortConnector {
  constructor(private forceDemo = false) {}
  async getCongestion(port: GeoPoint): Promise<ConnectorResult> {
    if (this.forceDemo || config.mode === "DEMO")
      return {
        signals: [
          {
            id: `demo-port-${port.code}`,
            source: "Deterministic port scenario",
            type: "PORT",
            timestamp: new Date().toISOString(),
            location: port.name,
            confidence: 0.91,
            title: `High queue pressure at ${port.name}`,
            description: "Deterministic demo port status; no provider claim is made.",
            provider: "DemoPortConnector",
            dataStatus: "DEMO",
            payload: { congestion: "HIGH", vesselCount: 14 },
          },
        ],
        provider: { provider: "DemoPortConnector", status: "DEMO" },
      };
    if (!process.env["PORTCAST_API_KEY"] || !process.env["PORTCAST_ORG_ID"])
      return {
        signals: [],
        provider: {
          provider: "Portcast",
          status: "UNAVAILABLE",
          reason: "missing_api_key_or_org_id",
        },
      };
    return {
      signals: [],
      provider: {
        provider: "Portcast",
        status: "UNAVAILABLE",
        reason: "provider_endpoint_not_configured",
      },
    };
  }
}
