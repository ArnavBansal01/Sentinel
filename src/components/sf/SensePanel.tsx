import { CheckCircle2, ExternalLink, Radio } from "lucide-react";

import { dateTime } from "@/lib/sf/format";
import type { DisruptionEvent } from "@/lib/sf/types";
import { Badge } from "./ui";

function sourceStatus(source: DisruptionEvent["sources"][number]) {
  return source.dataStatus ?? (source.simulated ? "DEMO" : "LIVE");
}

export function SensePanel({ event }: { event: DisruptionEvent }) {
  const ais = event.sources.filter((s) => s.connector === "AISConnector");
  const others = event.sources.filter((s) => s.connector !== "AISConnector");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label-xs">What we found</span>
            <h3 className="text-sm font-semibold">{event.title.replaceAll("_", " ").toLowerCase()}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={event.verified ? "warning" : "neutral"}>{event.category.replaceAll("_", " ")}</Badge>
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
          <article
            key={s.id}
            className={
              sourceStatus(s) === "LIVE"
                ? "rounded-lg border border-success/40 bg-success-surface/40 p-3 shadow-sm"
                : "rounded-lg border border-warning/35 bg-warning-surface/35 p-3"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">Check {i + 1}</span>
              <Badge
                tone={sourceStatus(s) === "LIVE" ? "success" : "warning"}
                className={sourceStatus(s) === "LIVE" ? "status-live" : ""}
              >
                {sourceStatus(s) === "LIVE" ? "LIVE DATA" : "DEMO DATA"}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-semibold">{s.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.summary}</p>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-info hover:underline"
              >
                Open source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="num mt-2 flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground">
              <span>{s.provider ?? s.connector}</span>
              <span>conf {Math.round(s.confidence * 100)}%</span>
            </div>
          </article>
        ))}
        {ais.map((s) => (
          <article
            key={s.id}
            className={
              sourceStatus(s) === "LIVE"
                ? "rounded-lg border border-success/40 bg-success-surface/40 p-3 shadow-sm"
                : "rounded-lg border border-warning/35 bg-warning-surface/35 p-3"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs text-info">Ship tracking check</span>
              <div className="flex items-center gap-2">
                <Badge
                  tone={sourceStatus(s) === "LIVE" ? "success" : "warning"}
                  className={sourceStatus(s) === "LIVE" ? "status-live" : ""}
                >
                  {sourceStatus(s) === "LIVE" ? "LIVE AIS" : "DEMO AIS"}
                </Badge>
                <Radio className="h-3.5 w-3.5 text-info" aria-hidden />
              </div>
            </div>
            <p className="mt-1 text-xs font-semibold">{s.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.summary}</p>
            <div className="num mt-2 flex items-center justify-between border-t border-info/20 pt-1.5 text-[10px] text-muted-foreground">
              <span>{s.provider ?? "AIS provider"}</span>
              <span>conf {Math.round(s.confidence * 100)}%</span>
            </div>
          </article>
        ))}
      </div>

      <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${event.verified ? "border-success/30 bg-success-surface" : "border-warning/30 bg-warning-surface"}`}>
        <CheckCircle2 className={`h-4 w-4 ${event.verified ? "text-success" : "text-warning"}`} aria-hidden />
        <span className={`text-xs font-semibold ${event.verified ? "text-success" : "text-warning"}`}>
          {event.verified ? "Disruption confirmed" : "No disruption confirmed"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Checked {event.sources.length} updates from{" "}
          {new Set(event.sources.map((s) => s.provider ?? s.connector)).size} independent data source(s)
        </span>
      </div>
    </div>
  );
}
