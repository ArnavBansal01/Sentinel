import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ShipmentStatusBadge } from "@/components/sf/ui";
import { usd } from "@/lib/sf/format";
import type { Shipment, ShipmentStatus } from "@/lib/sf/types";
import type { LiveMapProps } from "./LiveMap";

const STATUS_COLOR: Record<ShipmentStatus, string> = {
  on_track: "#38bdf8",
  monitoring: "#94a3b8",
  disrupted: "#fb923c",
  pending_approval: "#fbbf24",
  recovered: "#34d399",
  escalated: "#fb7185",
};

function markerIcon(status: ShipmentStatus, selected: boolean) {
  const color = STATUS_COLOR[status];
  const pulse = status === "disrupted" || status === "pending_approval";
  return L.divIcon({
    className: "sf-leaflet-marker",
    html: `<span class="sf-marker-shell${selected ? " is-selected" : ""}${pulse ? " is-pulsing" : ""}" style="--marker-color:${color}"><span></span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -15],
  });
}

function unwrapLongitude(previous: number, next: number) {
  let value = next;
  while (value - previous > 180) value -= 360;
  while (value - previous < -180) value += 360;
  return value;
}

function routePoints(shipment: Shipment): [number, number][] {
  const positionLon = unwrapLongitude(shipment.origin.lon, shipment.position.lon);
  const destinationLon = unwrapLongitude(positionLon, shipment.destination.lon);
  return [
    [shipment.origin.lat, shipment.origin.lon],
    [shipment.position.lat, positionLon],
    [shipment.destination.lat, destinationLon],
  ];
}

function MapLifecycle({ selected }: { selected?: Shipment | undefined }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (selected) map.panTo([selected.position.lat, selected.position.lon], { animate: true });
  }, [map, selected]);

  return null;
}

export function LiveMapClient({ shipments, affectedIds, selectedId, onSelect }: LiveMapProps) {
  const affected = useMemo(() => new Set(affectedIds), [affectedIds]);
  const selected = shipments.find((shipment) => shipment.id === selectedId);

  return (
    <>
      <MapContainer
        center={[20, 25]}
        zoom={2}
        minZoom={2}
        maxZoom={9}
        scrollWheelZoom
        worldCopyJump
        className="h-full w-full"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {shipments.map((shipment) => {
          const isAffected = affected.has(shipment.id);
          const isSelected = shipment.id === selectedId;
          return (
            <Polyline
              key={`route-${shipment.id}`}
              positions={routePoints(shipment)}
              pathOptions={{
                color: isAffected ? "#fb7185" : isSelected ? "#7dd3fc" : "#34d399",
                weight: isSelected ? 3.5 : 2,
                opacity: isSelected ? 1 : 0.68,
                dashArray: isAffected ? "9 7" : undefined,
              }}
              eventHandlers={{ click: () => onSelect?.(shipment.id) }}
            />
          );
        })}

        {shipments.map((shipment) => (
          <CircleMarker
            key={`origin-${shipment.id}`}
            center={[shipment.origin.lat, shipment.origin.lon]}
            radius={3}
            pathOptions={{ color: "#cbd5e1", weight: 1, fillColor: "#07111c", fillOpacity: 1 }}
          />
        ))}

        {shipments.map((shipment) => (
          <Marker
            key={shipment.id}
            position={[shipment.position.lat, shipment.position.lon]}
            icon={markerIcon(shipment.status, shipment.id === selectedId)}
            title={`${shipment.id}: ${shipment.origin.name} to ${shipment.destination.name}`}
          >
            <Popup className="sf-leaflet-popup">
              <div className="min-w-[220px] p-1 text-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold">{shipment.id}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">
                      {shipment.vessel}
                    </p>
                  </div>
                  <ShipmentStatusBadge status={shipment.status} />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-800">
                  {shipment.origin.name} → {shipment.destination.name}
                </p>
                <div className="mt-1 flex justify-between gap-4 text-[11px] text-slate-600">
                  <span>{shipment.cargo}</span>
                  <span className="font-semibold">{usd(shipment.cargoValueUsd)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect?.(shipment.id)}
                  className="mt-3 w-full rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Open shipment
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapLifecycle selected={selected} />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[450] flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#07111c]/90 px-3 py-2 text-[10px] text-slate-300 shadow-xl backdrop-blur">
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />
          Ship
        </span>
        <span>
          <i className="mr-1 inline-block h-0.5 w-4 bg-emerald-400" />
          Route
        </span>
        <span>
          <i className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-rose-400" />
          Disruption
        </span>
        <span className="ml-auto hidden sm:inline">
          Drag to move · Scroll to zoom · Select a ship
        </span>
      </div>
    </>
  );
}
