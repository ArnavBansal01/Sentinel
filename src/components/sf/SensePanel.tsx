import { CheckCircle2, Radio } from "lucide-react";

import { dateTime } from "@/lib/sf/format";
import type { DisruptionEvent } from "@/lib/sf/types";
import { Badge, DemoTag } from "./ui";

export function SensePanel({ event }: { event: DisruptionEvent }) {
  const ais = event.sources.filter((s) => s.connector === "AISConnector");
  const others = event.sources.filter((s) => s.connector !== "AISConnector");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label-xs">Why flagged</span>
            <h3 className="text-sm font-semibold">{event.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="warning">{event.category}</Badge>
            <span className="num text-[11px] text-muted-foreground">
              detected {dateTime(event.detectedAtIso)}
            </span>
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{event.summary}</p>
        <p className="num mt-1 text-[11px] text-muted-foreground">Location: {event.location}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {others.map((s, i) => (
          <article key={s.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">Source {i + 1}</span>
              <DemoTag>{s.simulated ? "Simulated signal" : "Live"}</DemoTag>
            </div>
            <p className="mt-1 text-xs font-semibold">{s.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.summary}</p>
            <div className="num mt-2 flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground">
              <span>{s.connector}</span>
              <span>conf {Math.round(s.confidence * 100)}%</span>
            </div>
          </article>
        ))}
        {ais.map((s) => (
          <article key={s.id} className="rounded-lg border border-info/30 bg-info-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs text-info">AIS confirmation</span>
              <Radio className="h-3.5 w-3.5 text-info" aria-hidden />
            </div>
            <p className="mt-1 text-xs font-semibold">{s.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.summary}</p>
            <div className="num mt-2 flex items-center justify-between border-t border-info/20 pt-1.5 text-[10px] text-muted-foreground">
              <span>Seeded AIS snapshot — not live</span>
              <span>conf {Math.round(s.confidence * 100)}%</span>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success-surface px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        <span className="text-xs font-semibold text-success">
          {event.verified ? "Disruption verified" : "Verification incomplete"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Source 1 + Source 2 + AIS confirmation = disruption verified
        </span>
      </div>
    </div>
  );
}
