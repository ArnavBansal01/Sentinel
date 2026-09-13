import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { Shipment } from "@/lib/sf/types";

const W = 720;
const H = 360;
const VIEW = { x: 0, y: 18, w: 720, h: 282 };

// Lightweight built-in coastlines keep the map visible while the detailed map loads.
const FALLBACK_LAND: number[][][] = [
  [[-168,70],[-130,72],[-100,55],[-82,25],[-105,8],[-135,20],[-168,55]],
  [[-82,12],[-50,10],[-35,-15],[-55,-55],[-75,-35]],
  [[-12,72],[35,70],[65,52],[48,35],[28,32],[8,44],[-12,58]],
  [[-18,35],[12,37],[38,12],[50,-28],[20,-36],[-5,2]],
  [[38,72],[115,72],[170,55],[145,25],[105,8],[72,22],[48,45]],
  [[112,-12],[154,-10],[152,-42],[116,-36]],
];

function px(lon: number): number {
  return ((lon + 180) / 360) * W;
}
function py(lat: number): number {
  return ((90 - lat) / 180) * H;
}

function unwrap(a: number, b: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d;
}

function routePath(s: Shipment): string {
  const o = { lon: s.origin.lon, lat: s.origin.lat };
  const mid = { lon: unwrap(o.lon, s.position.lon), lat: s.position.lat };
  const d = { lon: unwrap(mid.lon, s.destination.lon), lat: s.destination.lat };
  const p1 = [px(o.lon), py(o.lat)];
  const p2 = [px(mid.lon), py(mid.lat)];
  const p3 = [px(d.lon), py(d.lat)];
  return `M ${p1[0]} ${p1[1]} Q ${p2[0]} ${(p1[1]! + p2[1]!) / 2} ${p2[0]} ${p2[1]} T ${p3[0]} ${p3[1]}`;
}

export function WorldMap({
  shipments,
  affectedIds,
  selectedId,
  onSelect,
  className,
}: {
  shipments: Shipment[];
  affectedIds: string[];
  selectedId?: string | undefined;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const [land, setLand] = useState<number[][][]>(FALLBACK_LAND);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/world-land.geo.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("map unavailable"))))
      .then((data: number[][][]) => {
        if (!cancelled) setLand(data);
      })
      .catch(() => setLand(FALLBACK_LAND));
    return () => {
      cancelled = true;
    };
  }, []);

  const landPath = useMemo(() => {
    return land
      .map((ring) => {
        const pts = ring.map(([lon, lat]) => `${px(lon!).toFixed(1)} ${py(lat!).toFixed(1)}`);
        return `M ${pts.join(" L ")} Z`;
      })
      .join(" ");
  }, [land]);

  return (
    <div className={cn("relative h-full w-full bg-map-sea", className)}>
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="Operational map of monitored shipments"
      >
        <g opacity="0.55">
          {[-120, -60, 0, 60, 120].map((lon) => (
            <line key={lon} x1={px(lon)} y1={VIEW.y} x2={px(lon)} y2={VIEW.y + VIEW.h} stroke="var(--color-border)" strokeWidth="0.4" />
          ))}
          {[-40, -20, 0, 20, 40, 60].map((lat) => (
            <line key={lat} x1={0} y1={py(lat)} x2={W} y2={py(lat)} stroke="var(--color-border)" strokeWidth="0.4" />
          ))}
        </g>

        {landPath && <path d={landPath} fill="var(--color-map-land)" stroke="var(--color-border-strong)" strokeWidth="0.3" />}

        {shipments.map((s) => {
          const affected = affectedIds.includes(s.id);
          const selected = selectedId === s.id;
          return (
            <g
              key={s.id}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={onSelect ? () => onSelect(s.id) : undefined}
            >
              <path
                d={routePath(s)}
                fill="none"
                stroke={affected ? "var(--color-danger)" : "var(--color-map-route)"}
                strokeWidth={selected ? 1.6 : affected ? 1.3 : 0.8}
                strokeDasharray={affected ? "4 2" : undefined}
                opacity={affected || selected ? 0.95 : 0.5}
              />
              <rect x={px(s.origin.lon) - 1.6} y={py(s.origin.lat) - 1.6} width="3.2" height="3.2" fill="var(--color-muted-foreground)" />
              <rect x={px(s.destination.lon) - 1.6} y={py(s.destination.lat) - 1.6} width="3.2" height="3.2" fill="var(--color-muted-foreground)" />
              <circle
                cx={px(s.position.lon)}
                cy={py(s.position.lat)}
                r={selected ? 3.6 : 2.6}
                fill={affected ? "var(--color-danger)" : "var(--color-primary)"}
                stroke="var(--color-surface)"
                strokeWidth="1"
              />
              {affected && (
                <circle
                  cx={px(s.position.lon)}
                  cy={py(s.position.lat)}
                  r="6.5"
                  fill="none"
                  stroke="var(--color-danger)"
                  strokeWidth="0.8"
                  opacity="0.7"
                />
              )}
              <text
                x={px(s.position.lon) + 5}
                y={py(s.position.lat) - 4}
                fontSize="5.5"
                className="num"
                fill="var(--color-foreground)"
                opacity={affected || selected ? 1 : 0.75}
              >
                {s.id}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> In transit
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Disruption
        </span>
        <span>Saved positions — live ship tracking appears in checks</span>
      </div>
    </div>
  );
}
