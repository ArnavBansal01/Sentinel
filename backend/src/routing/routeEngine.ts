import { config } from "../config.js";
import type { GeoPoint, RoutePlan, Shipment, OptionType } from "../types/domain.js";
const alt: Record<string, GeoPoint> = {
  NLRTM: { name: "Antwerp", code: "BEANR", lat: 51.26, lon: 4.4 },
  KEMBA: { name: "Dar es Salaam", code: "TZDAR", lat: -6.82, lon: 39.29 },
  USLAX: { name: "Long Beach", code: "USLGB", lat: 33.75, lon: -118.22 },
};
export function greatCircleDistanceNm(a: GeoPoint, b: GeoPoint) {
  const R = 3440.065,
    p1 = (a.lat * Math.PI) / 180,
    p2 = (b.lat * Math.PI) / 180,
    dp = ((b.lat - a.lat) * Math.PI) / 180,
    dl = ((b.lon - a.lon) * Math.PI) / 180;
  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2),
    )
  );
}
export function routeFor(s: Shipment, type: OptionType): RoutePlan {
  const via =
    type === "reroute"
      ? { name: "Cape route", code: "CAPE", lat: -34.36, lon: 18.47 }
      : type === "switch_mode"
        ? (alt[s.destination.code] ?? s.destination)
        : {
            name: "Optimized waypoint",
            code: "OPT",
            lat: (s.origin.lat + s.destination.lat) / 2,
            lon: (s.origin.lon + s.destination.lon) / 2,
          };
  const base = greatCircleDistanceNm(s.origin, s.destination);
  const factor = type === "reroute" ? 1.18 : type === "switch_mode" ? 1.08 : 0.98;
  const d = Math.round(base * factor);
  const delta = Math.max(
    0,
    Math.round(((d - base) / config.routing.vesselSpeedKnots / 24) * 10) / 10,
  );
  return {
    points: [s.origin, via, s.destination],
    distanceNm: d,
    etaDeltaDays: delta,
    fuelDeltaTonnes: Math.round(Math.abs(d - base) * config.routing.fuelTonnesPerNm),
    riskScore: type === "reroute" ? 24 : type === "respeed" ? 42 : 31,
  };
}
