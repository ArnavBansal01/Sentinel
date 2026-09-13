import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Shipment } from "@/lib/sf/types";

const W = 720;
const H = 360;
const WORLD_VIEW = { x: 0, y: 0, w: 720, h: 360 };
const MIN_VIEW_WIDTH = 120;

// Lightweight built-in coastlines keep the map visible while the detailed map loads.
const FALLBACK_LAND: number[][][] = [
  [[-168, 70], [-130, 72], [-100, 55], [-82, 25], [-105, 8], [-135, 20], [-168, 55]],
  [[-82, 12], [-50, 10], [-35, -15], [-55, -55], [-75, -35]],
  [[-12, 72], [35, 70], [65, 52], [48, 35], [28, 32], [8, 44], [-12, 58]],
  [[-18, 35], [12, 37], [38, 12], [50, -28], [20, -36], [-5, 2]],
  [[38, 72], [115, 72], [170, 55], [145, 25], [105, 8], [72, 22], [48, 45]],
  [[112, -12], [154, -10], [152, -42], [116, -36]],
];

type ViewBox = typeof WORLD_VIEW;
type DragState = { id: number; x: number; y: number; view: ViewBox; moved: boolean };

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

function routePath(s: Shipment, shift = 0): string {
  const originLon = s.origin.lon;
  const positionLon = unwrap(originLon, s.position.lon);
  const destinationLon = unwrap(positionLon, s.destination.lon);
  const p1: [number, number] = [px(originLon) + shift, py(s.origin.lat)];
  const p2: [number, number] = [px(positionLon) + shift, py(s.position.lat)];
  const p3: [number, number] = [px(destinationLon) + shift, py(s.destination.lat)];
  const control1: [number, number] = [(p1[0] + p2[0]) / 2, Math.min(p1[1], p2[1]) - 9];
  const control2: [number, number] = [(p2[0] + p3[0]) / 2, Math.min(p2[1], p3[1]) - 9];
  return `M ${p1[0]} ${p1[1]} Q ${control1[0]} ${control1[1]} ${p2[0]} ${p2[1]} Q ${control2[0]} ${control2[1]} ${p3[0]} ${p3[1]}`;
}

function constrainView(view: ViewBox): ViewBox {
  const w = Math.min(WORLD_VIEW.w, Math.max(MIN_VIEW_WIDTH, view.w));
  const h = w * (H / W);
  return {
    // Longitude wraps continuously, so the world can always be dragged left or right.
    x: ((view.x % W) + W) % W,
    y: Math.min(H - h, Math.max(0, view.y)),
    w,
    h,
  };
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
  const [view, setView] = useState<ViewBox>(WORLD_VIEW);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const selectedShipment = shipments.find((shipment) => shipment.id === selectedId);
  const zoomPercent = Math.round((WORLD_VIEW.w / view.w) * 100);

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

  useEffect(() => {
    const syncFullscreen = () => setIsMapFullscreen(document.fullscreenElement === mapRef.current);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setIsMapFullscreen(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const landPath = useMemo(
    () =>
      land
        .filter((ring) =>
          ring.every((point, index) => {
            const previous = ring[index - 1];
            return !previous || Math.abs(point[0]! - previous[0]!) <= 180;
          }),
        )
        .map((ring) => {
          const pts = ring.map(([lon, lat]) => `${px(lon!).toFixed(1)} ${py(lat!).toFixed(1)}`);
          return `M ${pts.join(" L ")} Z`;
        })
        .join(" "),
    [land],
  );

  // Draw coastlines as split, open segments so polygons crossing the date line
  // never create long horizontal seams across the map.
  const coastlinePath = useMemo(
    () =>
      land
        .flatMap((ring) => {
          const segments: string[] = [];
          let segment: string[] = [];
          ring.forEach(([lon, lat], index) => {
            const previous = ring[index - 1];
            if (previous && Math.abs(lon! - previous[0]!) > 180) {
              if (segment.length > 1) segments.push(`M ${segment.join(" L ")}`);
              segment = [];
            }
            segment.push(`${px(lon!).toFixed(1)} ${py(lat!).toFixed(1)}`);
          });
          if (segment.length > 1) segments.push(`M ${segment.join(" L ")}`);
          return segments;
        })
        .join(" "),
    [land],
  );

  const zoomAt = (factor: number, screenX?: number, screenY?: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const anchorX = rect && screenX !== undefined ? (screenX - rect.left) / rect.width : 0.5;
    const anchorY = rect && screenY !== undefined ? (screenY - rect.top) / rect.height : 0.5;
    setView((current) => {
      const nextWidth = current.w * factor;
      const nextHeight = nextWidth * (H / W);
      return constrainView({
        x: current.x + (current.w - nextWidth) * anchorX,
        y: current.y + (current.h - nextHeight) * anchorY,
        w: nextWidth,
        h: nextHeight,
      });
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const anchorX = (event.clientX - rect.left) / rect.width;
      const anchorY = (event.clientY - rect.top) / rect.height;
      const factor = event.deltaY > 0 ? 1.18 : 0.84;
      setView((current) => {
        const nextWidth = current.w * factor;
        const nextHeight = nextWidth * (H / W);
        return constrainView({
          x: current.x + (current.w - nextWidth) * anchorX,
          y: current.y + (current.h - nextHeight) * anchorY,
          w: nextWidth,
          h: nextHeight,
        });
      });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!drag || drag.id !== event.pointerId || !rect) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    setView(
      constrainView({
        ...drag.view,
        x: drag.view.x - dx * (drag.view.w / rect.width),
        y: drag.view.y - dy * (drag.view.h / rect.height),
      }),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  const selectShipment = (id: string) => {
    if (!dragRef.current?.moved) onSelect?.(id);
  };

  const openShipment = (id: string) => {
    onSelect?.(id);
  };

  const toggleMapFullscreen = async () => {
    if (isMapFullscreen) {
      if (document.fullscreenElement === mapRef.current) {
        try {
          await document.exitFullscreen();
        } catch {
          // The CSS fallback below still closes the expanded map.
        }
      }
      setIsMapFullscreen(false);
      return;
    }

    if (mapRef.current?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await mapRef.current.requestFullscreen();
        setIsMapFullscreen(true);
        return;
      } catch {
        // Embedded previews can reject fullscreen; use a CSS fullscreen fallback.
      }
    }
    setIsMapFullscreen(true);
  };

  return (
    <div
      ref={mapRef}
      className={cn(
        "group/map relative h-full w-full overflow-hidden bg-map-sea",
        isMapFullscreen && !document.fullscreenElement && "fixed inset-0 z-[120] h-[100dvh] w-screen",
        className,
      )}
    >
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="group"
        aria-label="Interactive operational map. Drag to move and use the mouse wheel or controls to zoom."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <filter id="route-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="sea-glow" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="var(--color-info)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-map-sea)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {[0, W].map((shift) => (
          <g key={shift} transform={`translate(${shift} 0)`} pointerEvents="none">
            <rect width={W} height={H} fill="url(#sea-glow)" />
            <g opacity="0.5">
              {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
                <line key={lon} x1={px(lon)} y1={0} x2={px(lon)} y2={H} stroke="var(--color-border)" strokeWidth="0.35" />
              ))}
              {[-60, -40, -20, 0, 20, 40, 60, 80].map((lat) => (
                <line key={lat} x1={0} y1={py(lat)} x2={W} y2={py(lat)} stroke="var(--color-border)" strokeWidth="0.35" />
              ))}
            </g>
            {landPath && <path d={landPath} fill="var(--color-map-land)" stroke="none" />}
            {coastlinePath && <path d={coastlinePath} fill="none" stroke="var(--color-border-strong)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />}
          </g>
        ))}

        {shipments.map((shipment) => {
          const affected = affectedIds.includes(shipment.id);
          const selected = selectedId === shipment.id;
          const routeColor = affected ? "var(--color-danger)" : selected ? "var(--color-primary)" : "var(--color-map-route)";
          return (
            <g key={shipment.id} className={onSelect ? "cursor-pointer" : undefined} onClick={() => selectShipment(shipment.id)}>
              <title>{`${shipment.id}: ${shipment.origin.name} to ${shipment.destination.name}. Risk ${shipment.riskScore}.`}</title>
              {[-W, 0, W].map((shift) => (
                <g key={shift}>
                  {(selected || affected) && <path d={routePath(shipment, shift)} fill="none" stroke={routeColor} strokeWidth="5" opacity="0.16" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
                  <path d={routePath(shipment, shift)} fill="none" stroke={routeColor} strokeWidth={selected ? 2.3 : affected ? 2 : 1.25} strokeDasharray={affected ? "7 4" : undefined} opacity={affected || selected ? 1 : 0.66} vectorEffect="non-scaling-stroke" filter={selected ? "url(#route-glow)" : undefined} className={affected ? "map-route-alert" : undefined} />
                </g>
              ))}

              {[0, W].map((shift) => (
                <g key={`markers-${shift}`} transform={`translate(${shift} 0)`}>
                  <g transform={`translate(${px(shipment.origin.lon)} ${py(shipment.origin.lat)})`}>
                    <circle r="3.2" fill="var(--color-surface)" stroke={routeColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    {(selected || view.w < 340) && <text x="5" y="-4" fontSize="6" fill="var(--color-muted-foreground)">{shipment.origin.code}</text>}
                  </g>
                  <g transform={`translate(${px(shipment.destination.lon)} ${py(shipment.destination.lat)})`}>
                    <circle r="3.2" fill={routeColor} stroke="var(--color-surface)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
                    {(selected || view.w < 340) && <text x="5" y="-4" fontSize="6" fill="var(--color-muted-foreground)">{shipment.destination.code}</text>}
                  </g>

                  <g
                    role={onSelect && shift === 0 ? "link" : undefined}
                    tabIndex={onSelect && shift === 0 ? 0 : undefined}
                    aria-label={onSelect && shift === 0 ? `Open ${shipment.id}, ${shipment.origin.name} to ${shipment.destination.name}` : undefined}
                    className={cn("group/ship focus:outline-none", onSelect && "cursor-pointer")}
                    onPointerDown={(event) => {
                      if (onSelect) event.stopPropagation();
                    }}
                    onClick={(event) => {
                      if (!onSelect) return;
                      event.stopPropagation();
                      openShipment(shipment.id);
                    }}
                    onKeyDown={(event) => {
                      if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      event.stopPropagation();
                      openShipment(shipment.id);
                    }}
                  >
                    <title>{`Open ${shipment.id}`}</title>
                    <circle
                      cx={px(shipment.position.lon)}
                      cy={py(shipment.position.lat)}
                      r="10"
                      fill="transparent"
                      pointerEvents={onSelect ? "all" : "none"}
                    />
                    <circle
                      cx={px(shipment.position.lon)}
                      cy={py(shipment.position.lat)}
                      r={selected ? 7.5 : 6.5}
                      fill="none"
                      stroke={affected ? "var(--color-danger)" : "var(--color-primary)"}
                      strokeWidth="1.5"
                      opacity={selected ? 0.55 : 0}
                      vectorEffect="non-scaling-stroke"
                      className="transition-opacity group-hover/ship:opacity-50 group-focus/ship:opacity-70"
                      pointerEvents="none"
                    />
                    {affected && <circle cx={px(shipment.position.lon)} cy={py(shipment.position.lat)} r="8" fill="none" stroke="var(--color-danger)" strokeWidth="1.5" opacity="0.65" vectorEffect="non-scaling-stroke" pointerEvents="none" className="map-alert-ring" />}
                    <circle cx={px(shipment.position.lon)} cy={py(shipment.position.lat)} r={selected ? 4.6 : 3.5} fill={affected ? "var(--color-danger)" : "var(--color-primary)"} stroke="var(--color-surface)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                    <text x={px(shipment.position.lon) + 6} y={py(shipment.position.lat) - 5} fontSize={selected ? "7" : "6"} fontWeight={selected ? "700" : "600"} className="num" fill="var(--color-foreground)" paintOrder="stroke" stroke="var(--color-map-sea)" strokeWidth="2" opacity={affected || selected || view.w < 420 ? 1 : 0.8} pointerEvents="none">
                      {shipment.id}
                    </text>
                  </g>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg backdrop-blur">
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomAt(0.72)} className="grid h-9 w-9 place-items-center text-foreground hover:bg-accent" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <div className="border-y border-border px-1 py-1 text-center text-[9px] font-semibold text-muted-foreground">{zoomPercent}%</div>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomAt(1.38)} className="grid h-9 w-9 place-items-center text-foreground hover:bg-accent" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setView(WORLD_VIEW)} className="grid h-9 w-9 place-items-center border-t border-border text-foreground hover:bg-accent" aria-label="Reset world view" title="Reset world view"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleMapFullscreen} className="grid h-9 w-9 place-items-center border-t border-border text-foreground hover:bg-accent" aria-label={isMapFullscreen ? "Exit map fullscreen" : "Open map fullscreen"} title={isMapFullscreen ? "Exit map fullscreen" : "Open map fullscreen"}>
          {isMapFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {selectedShipment && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)] rounded-lg border border-primary/30 bg-surface/95 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2"><span className="num text-xs font-bold text-primary">{selectedShipment.id}</span><span className="text-[10px] text-muted-foreground">RISK {selectedShipment.riskScore}</span></div>
          <p className="mt-0.5 truncate text-xs font-medium">{selectedShipment.origin.name} → {selectedShipment.destination.name}</p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-surface/90 px-3 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20" /> Ship</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-map-route" /> Route</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed border-danger" /> Disruption</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-foreground bg-surface" /> Start</span>
        </div>
        <span className="hidden sm:inline">Drag to move · Scroll to zoom · Select a ship for details</span>
      </div>
    </div>
  );
}
