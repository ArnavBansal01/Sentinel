import { Link } from "@tanstack/react-router";
import { ChevronRight, Snowflake } from "lucide-react";

import { cn } from "@/lib/utils";
import { dateTime, usd } from "@/lib/sf/format";
import type { Shipment } from "@/lib/sf/types";
import { ShipmentStatusBadge } from "./ui";

function riskTone(risk: number): string {
  if (risk >= 60) return "text-danger";
  if (risk >= 35) return "text-warning";
  return "text-success";
}

export function ShipmentList({
  shipments,
  onHover,
}: {
  shipments: Shipment[];
  onHover?: (id: string | undefined) => void;
}) {
  return (
    <ul className="grid w-full auto-rows-min grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
      {shipments.map((s) => (
        <li key={s.id} className="min-w-0">
          <Link
            to="/shipment/$id"
            params={{ id: s.id }}
            onMouseEnter={() => onHover?.(s.id)}
            onMouseLeave={() => onHover?.(undefined)}
            className="group grid h-full min-h-[112px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/45 hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="num whitespace-nowrap text-xs font-semibold">{s.id}</span>
                {s.coldChain && (
                  <span
                    className="inline-flex items-center gap-1 rounded border border-info/25 bg-info-surface px-1 text-[10px] font-semibold tracking-wide text-info uppercase"
                    title="Cold chain constraint"
                  >
                    <Snowflake className="h-2.5 w-2.5" /> Cold chain
                  </span>
                )}
                <ShipmentStatusBadge status={s.status} />
              </div>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {s.origin.name} → {s.destination.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted-foreground">
                {s.cargo} · ETA {dateTime(s.etaIso)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-xs font-semibold">{usd(s.cargoValueUsd)}</p>
              <p className={cn("num text-[11px] font-medium", riskTone(s.riskScore))}>
                risk {s.riskScore}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
