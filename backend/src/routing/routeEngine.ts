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
      : type === "port_switch"
        ? (alt[s.destination.code] ?? s.destination)
        : {
            name: type === "hold_and_wait" ? "Bonded holding point" : "Optimized waypoint",
            code: "OPT",
            lat: (s.origin.lat + s.destination.lat) / 2,
            lon: (s.origin.lon + s.destination.lon) / 2,
          };
  const base = greatCircleDistanceNm(s.origin, s.destination);
  const factor: Record<OptionType, number> = {
    reroute: 1.18,
    respeed: 0.98,
    port_switch: 1.08,
    hold_and_wait: 1,
    accept_loss: 0,
  };
  const d = Math.round(base * factor[type]);
  const delta = Math.max(
    0,
    Math.round(((d - base) / config.routing.vesselSpeedKnots / 24) * 10) / 10,
  );
  return {
    points: type === "accept_loss" ? [s.origin] : [s.origin, via, s.destination],
    distanceNm: d,
    etaDeltaDays: delta,
    fuelDeltaTonnes: Math.round(Math.abs(d - base) * config.routing.fuelTonnesPerNm),
    riskScore: type === "reroute" ? 24 : type === "respeed" ? 42 : type === "accept_loss" ? 88 : 31,
  };
}
