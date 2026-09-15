import { config } from "../config.js";
import type { GeoPoint, OptionType, RoutePlan, Shipment } from "../types/domain.js";

const alternatePorts: Record<string, GeoPoint> = {
  NLRTM: { name: "Port of Antwerp-Bruges", code: "BEANR", lat: 51.26, lon: 4.4 },
  KEMBA: { name: "Port of Dar es Salaam", code: "TZDAR", lat: -6.82, lon: 39.29 },
  USLAX: { name: "Port of Long Beach", code: "USLGB", lat: 33.75, lon: -118.22 },
  DEHAM: { name: "Port of Bremerhaven", code: "DEBRV", lat: 53.54, lon: 8.58 },
  USSEA: { name: "Port of Tacoma", code: "USTIW", lat: 47.27, lon: -122.42 },
  GBFXT: { name: "Port of Southampton", code: "GBSOU", lat: 50.9, lon: -1.4 },
  USNYC: { name: "Port of Norfolk", code: "USORF", lat: 36.85, lon: -76.29 },
  ZADUR: { name: "Port of Cape Town", code: "ZACPT", lat: -33.91, lon: 18.42 },
};

const candidatePorts = Object.values(alternatePorts);

const laneWaypoints: Record<string, GeoPoint[]> = {
  "CNNGB-NLRTM": [
    { name: "Singapore Strait", code: "SGSTR", lat: 1.25, lon: 103.84 },
    { name: "Cape of Good Hope", code: "CAPE", lat: -34.36, lon: 18.47 },
    { name: "Strait of Gibraltar", code: "GIB", lat: 35.96, lon: -5.61 },
    { name: "English Channel", code: "ENGCH", lat: 50.1, lon: -1.5 },
  ],
  "BEANR-KEMBA": [
    { name: "Strait of Gibraltar", code: "GIB", lat: 35.96, lon: -5.61 },
    { name: "Cape of Good Hope", code: "CAPE", lat: -34.36, lon: 18.47 },
    { name: "Mozambique Channel", code: "MOZCH", lat: -18.0, lon: 41.0 },
  ],
  "CNSHA-USLAX": [
    { name: "Luzon Strait", code: "LUZON", lat: 20.0, lon: 122.0 },
    { name: "South Pacific diversion point", code: "SPDIV", lat: 27.0, lon: 165.0 },
    { name: "California approach", code: "CALAPP", lat: 31.0, lon: -128.0 },
  ],
  "BRSSZ-DEHAM": [
    { name: "Central Atlantic diversion point", code: "ATLDIV", lat: 18.0, lon: -32.0 },
    { name: "English Channel", code: "ENGCH", lat: 50.1, lon: -1.5 },
  ],
  "KRPUS-USSEA": [
    { name: "Tsugaru Strait", code: "TSUGARU", lat: 41.5, lon: 140.5 },
    { name: "North Pacific diversion point", code: "NPDIV", lat: 44.0, lon: 170.0 },
    { name: "Gulf of Alaska approach", code: "AKAPP", lat: 49.0, lon: -145.0 },
  ],
  "AEJEA-GBFXT": [
    { name: "Arabian Sea", code: "ARAB", lat: 14.0, lon: 60.0 },
    { name: "Cape of Good Hope", code: "CAPE", lat: -34.36, lon: 18.47 },
    { name: "Strait of Gibraltar", code: "GIB", lat: 35.96, lon: -5.61 },
    { name: "English Channel", code: "ENGCH", lat: 50.1, lon: -1.5 },
  ],
  "ESVLC-USNYC": [
    { name: "Azores south passage", code: "AZORES", lat: 35.5, lon: -25.5 },
    { name: "North Atlantic diversion point", code: "NADIV", lat: 38.0, lon: -48.0 },
    { name: "New York approach", code: "NYAPP", lat: 39.5, lon: -70.0 },
  ],
  "INMAA-ZADUR": [
    { name: "South Indian Ocean diversion point", code: "IODIV", lat: -18.0, lon: 66.0 },
    { name: "Madagascar south passage", code: "MADPASS", lat: -28.0, lon: 45.0 },
  ],
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

function routeDistance(points: GeoPoint[]): number {
  return Math.round(
    points
      .slice(1)
      .reduce((total, point, index) => total + greatCircleDistanceNm(points[index]!, point), 0),
  );
}

function nearestAlternatePort(shipment: Shipment): GeoPoint {
  const configured = alternatePorts[shipment.destination.code];
  if (configured) return configured;
  return [...candidatePorts]
    .filter((port) => port.code !== shipment.origin.code && port.code !== shipment.destination.code)
    .sort(
      (a, b) =>
        greatCircleDistanceNm(shipment.destination, a) -
        greatCircleDistanceNm(shipment.destination, b),
    )[0]!;
}

function fallbackWaypoint(shipment: Shipment): GeoPoint {
  const lonDelta = ((shipment.destination.lon - shipment.origin.lon + 540) % 360) - 180;
  const lon = ((shipment.origin.lon + lonDelta / 2 + 540) % 360) - 180;
  return {
    name: "Offshore diversion waypoint",
    code: "DIVERT",
    lat: (shipment.origin.lat + shipment.destination.lat) / 2 - 5,
    lon,
  };
}

function guidanceFor(
  shipment: Shipment,
  type: OptionType,
): { points: GeoPoint[]; guidance?: RoutePlan["guidance"] } {
  if (type === "reroute") {
    const waypoints = laneWaypoints[`${shipment.origin.code}-${shipment.destination.code}`] ?? [
      fallbackWaypoint(shipment),
    ];
    const points = [shipment.origin, ...waypoints, shipment.destination];
    return {
      points,
      guidance: {
        title: `Sail via ${waypoints.map((point) => point.name).join(" and ")}`,
        routeText: points.map((point) => point.name).join(" → "),
        destination: shipment.destination,
        steps: [
          `Depart ${shipment.origin.name} and follow the ordered waypoints shown below.`,
          `Pass ${waypoints.map((point) => point.name).join(" → ")}.`,
          `Rejoin the destination approach for ${shipment.destination.name} (${shipment.destination.code}).`,
        ],
        confirmationRequired: true,
      },
    };
  }

  if (type === "port_switch") {
    const alternate = nearestAlternatePort(shipment);
    return {
      points: [shipment.origin, alternate],
      guidance: {
        title: `Divert to ${alternate.name} (${alternate.code})`,
        routeText: `${shipment.origin.name} → ${alternate.name}`,
        destination: alternate,
        steps: [
          `Request an alternate berth and handling window at ${alternate.name} (${alternate.code}).`,
          `Sail from ${shipment.origin.name} to ${alternate.name}.`,
          `Transfer the cargo onward to ${shipment.destination.name} after discharge.`,
        ],
        onwardLeg: `${alternate.name} → ${shipment.destination.name} by confirmed feeder or inland carrier`,
        confirmationRequired: true,
      },
    };
  }

  const midpoint = {
    name: type === "hold_and_wait" ? "Bonded holding point" : "Optimized waypoint",
    code: type === "hold_and_wait" ? "HOLD" : "OPT",
    lat: (shipment.origin.lat + shipment.destination.lat) / 2,
    lon: (((shipment.origin.lon + shipment.destination.lon) / 2 + 540) % 360) - 180,
  };
  return {
    points:
      type === "accept_loss"
        ? [shipment.origin]
        : [shipment.origin, midpoint, shipment.destination],
  };
}

export function routeFor(shipment: Shipment, type: OptionType): RoutePlan {
  const { points, guidance } = guidanceFor(shipment, type);
  const base = greatCircleDistanceNm(shipment.origin, shipment.destination);
  const distanceNm = type === "accept_loss" ? 0 : routeDistance(points);
  const etaDeltaDays = Math.max(
    0,
    Math.round(((distanceNm - base) / config.routing.vesselSpeedKnots / 24) * 10) / 10,
  );
  return {
    points,
    distanceNm,
    etaDeltaDays,
    fuelDeltaTonnes: Math.round(Math.max(0, distanceNm - base) * config.routing.fuelTonnesPerNm),
    riskScore: type === "reroute" ? 24 : type === "respeed" ? 42 : type === "accept_loss" ? 88 : 31,
    ...(guidance ? { guidance } : {}),
  };
}
