import type { GeoPoint, ProviderStatus, Shipment, Signal } from "../types/domain.js";
export interface ConnectorResult {
  signals: Signal[];
  provider: ProviderStatus;
}
export interface NewsConnector {
  search(shipment: Shipment): Promise<ConnectorResult>;
}
export interface WeatherConnector {
  getForecast(points: GeoPoint[]): Promise<ConnectorResult>;
}
export interface AISConnector {
  getRecentVessels(shipment: Shipment): Promise<ConnectorResult>;
}
export interface PortConnector {
  getCongestion(port: GeoPoint): Promise<ConnectorResult>;
}
