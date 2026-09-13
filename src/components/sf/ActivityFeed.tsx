import { cn } from "@/lib/utils";
import { timeOnly } from "@/lib/sf/format";
import type { OperationalEvent } from "@/lib/sf/types";

const STAGE_LABEL: Record<OperationalEvent["stage"], string> = {
  sense: "SENSE",
  decide: "SIMULATE",
  validate: "DECIDE",
  act: "COMMIT",
  ledger: "SAVED",
};

const STATUS_BAR: Record<OperationalEvent["status"], string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function ActivityFeed({ events }: { events: OperationalEvent[] }) {
  return (
    <ol className="divide-y divide-border overflow-y-auto">
      {events.map((e) => (
        <li key={e.id} className="activity-entry flex gap-3 px-4 py-3.5 first:bg-success-surface/25">
          <span
            className={cn("mt-1 h-full w-0.5 shrink-0 rounded", STATUS_BAR[e.status])}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="num text-[11px] text-muted-foreground">{timeOnly(e.atIso)}</span>
              <span className="label-xs text-foreground/70">{STAGE_LABEL[e.stage]}</span>
              <span className="num truncate text-[11px] text-muted-foreground">{e.shipmentId}</span>
              {e === events[0] && (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-bold tracking-wider text-success uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  latest
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-foreground">{e.type}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{e.message}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
