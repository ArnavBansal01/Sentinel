import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { Shipment } from "@/lib/sf/types";
import { cn } from "@/lib/utils";

export interface LiveMapProps {
  shipments: Shipment[];
  affectedIds: string[];
  selectedId?: string | undefined;
  onSelect?: (id: string) => void;
  className?: string;
}

export function LiveMap(props: LiveMapProps) {
  const [ClientMap, setClientMap] = useState<ComponentType<LiveMapProps> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    import("./LiveMapClient").then((module) => {
      if (active) setClientMap(() => module.LiveMapClient);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen();
      return;
    }
    if (containerRef.current?.requestFullscreen && document.fullscreenEnabled) {
      await containerRef.current.requestFullscreen();
      return;
    }
    setIsFullscreen((current) => !current);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full min-h-[320px] w-full overflow-hidden bg-map-sea",
        isFullscreen && !document.fullscreenElement && "fixed inset-0 z-[120] h-[100dvh] w-screen",
        props.className,
      )}
    >
      {ClientMap ? (
        <ClientMap {...props} />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted-foreground" aria-busy>
          Loading live map…
        </div>
      )}

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-[500] grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-surface/90 text-foreground shadow-lg backdrop-blur-xl hover:bg-accent"
        aria-label={isFullscreen ? "Exit map fullscreen" : "Open map fullscreen"}
        title={isFullscreen ? "Exit map fullscreen" : "Open map fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
