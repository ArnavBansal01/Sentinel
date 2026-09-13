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
    <ul className="divide-y divide-border overflow-y-auto">
      {shipments.map((s) => (
        <li key={s.id}>
          <Link
            to="/shipment/$id"
            params={{ id: s.id }}
            onMouseEnter={() => onHover?.(s.id)}
            onMouseLeave={() => onHover?.(undefined)}
            className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="num text-xs font-semibold">{s.id}</span>
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
              <p className="truncate text-xs text-foreground">
                {s.origin.name} → {s.destination.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {s.cargo} · ETA {dateTime(s.etaIso)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-xs font-semibold">{usd(s.cargoValueUsd)}</p>
              <p className={cn("num text-[11px] font-medium", riskTone(s.riskScore))}>risk {s.riskScore}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
