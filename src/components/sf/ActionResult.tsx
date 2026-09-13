import { Link } from "@tanstack/react-router";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { dateTime } from "@/lib/sf/format";
import type { ActResult, WorkflowRun } from "@/lib/sf/types";
import { Badge, DemoTag } from "./ui";

export function ActionResultPanel({ run }: { run: WorkflowRun }) {
  if (run.state === "REJECTED_ESCALATED") {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning-surface p-3">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-warning" aria-hidden />
          <span className="text-sm font-semibold text-warning">
            Plan rejected — nothing changed
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Escalated by {run.approval?.actorName} at {run.approval ? dateTime(run.approval.atIso) : "—"}. The
          shipment stays on its original route and has been sent for review.
        </p>
        {run.approval?.note && (
          <p className="mt-1 text-xs text-muted-foreground">Reason: {run.approval.note}</p>
        )}
      </div>
    );
  }

  const act: ActResult | null = run.act;
  if (!act) return null;

  const actor =
    run.state === "AUTO_COMMITTED"
      ? "SYSTEM / AUTONOMOUS"
      : (run.approval?.actorName ?? "SYSTEM / AUTONOMOUS");

  return (
    <div className="rounded-lg border border-success/40 bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          <span className="text-sm font-semibold">Plan applied</span>
          <Badge tone="success">{run.state === "AUTO_COMMITTED" ? "Applied automatically" : "Applied"}</Badge>
        </div>
        {act.simulated ? <DemoTag>Message delivery is demo</DemoTag> : <Badge tone="success">Live action saved</Badge>}
      </div>

      <p className="mt-1.5 text-xs text-foreground">{act.committedLabel}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-border pt-2.5 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Actor</dt>
          <dd className="num font-medium">{actor}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Applied at</dt>
          <dd className="num">{dateTime(act.executedAtIso)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Route updated</dt>
          <dd>{act.routeRedrawn ? "Yes — shipment state updated" : "No"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Message status</dt>
          <dd className="text-right">{act.partnersNotified.join(", ") || "None"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Decision record</dt>
          <dd className="num font-medium">
            <Link to="/ledger" className="underline underline-offset-2 hover:text-primary">
              {act.ledgerRef}
            </Link>
          </dd>
        </div>
      </dl>
    </div>
  );
}
