import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Snowflake } from "lucide-react";

import { ActionResultPanel } from "@/components/sf/ActionResult";
import { ApprovalPanel } from "@/components/sf/ApprovalPanel";
import { AppShell } from "@/components/sf/AppShell";
import { DecisionComparison } from "@/components/sf/DecisionWorkspace";
import { RequireSession } from "@/components/sf/guard";
import { SensePanel } from "@/components/sf/SensePanel";
import { Badge, Button, DecisionStateBadge, EmptyState, Panel, ShipmentStatusBadge } from "@/components/sf/ui";
import { dateTime, usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";
import type { WorkflowRun } from "@/lib/sf/types";

export const Route = createFileRoute("/shipment/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Shipment ${params.id} — Sentinel Flash` },
      {
        name: "description",
        content: `Sense, decide and act workspace for shipment ${params.id}: evidence chain, recovery options, constraint enforcement and committed action.`,
      },
      { property: "og:title", content: `Shipment ${params.id} — Sentinel Flash` },
      {
        property: "og:description",
        content: `Disruption evidence, recovery option comparison and decision outcome for shipment ${params.id}.`,
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <ShipmentDetail />
    </RequireSession>
  ),
});

const STAGE_SEQUENCE = ["Sense", "Simulate", "Decide", "Commit"] as const;

function stageIndex(run: WorkflowRun | undefined, busy: boolean): number {
  if (!run) return busy ? 0 : -1;
  if (run.state === "ERROR") return -1;
  if (busy) return run.state === "DECISION_GENERATING" ? 1 : 0;
  switch (run.state) {
    case "DISRUPTION_DETECTED":
    case "SENSE_COMPLETE":
      return 0;
    case "DECISION_GENERATING":
      return 1;
    case "DECISION_READY":
    case "PENDING_APPROVAL":
      return 2;
    default:
      return 3;
  }
}

function ShipmentDetail() {
  const { id } = Route.useParams();
  const { state, triggerScenario, isBusy } = useSentinel();
  const shipment = state.shipments.find((s) => s.id === id);
  const run = state.runs[id];
  const busy = isBusy(id);

  if (!shipment) {
    return (
      <AppShell title="Shipment not found">
        <div className="p-6">
          <EmptyState title="Shipment not found" description="This shipment is not in the current list." />
        </div>
      </AppShell>
    );
  }

  const decision = run?.decision ?? null;
  const active = stageIndex(run, busy);

  return (
    <AppShell
      title={`${shipment.id} · ${shipment.origin.name} → ${shipment.destination.name}`}
      subtitle={`${shipment.cargo} · ${shipment.vessel}`}
      actions={
        <Link
          to="/planner"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Control tower
        </Link>
      }
    >
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        {/* Header facts */}
        <div className="panel grid grid-cols-2 gap-y-3 px-4 py-3 md:grid-cols-4 xl:grid-cols-7">
          <Fact label="Status" value={<ShipmentStatusBadge status={shipment.status} />} />
          <Fact label="Cargo value" value={<span className="num font-semibold">{usdExact(shipment.cargoValueUsd)}</span>} />
          <Fact label="ETA" value={<span className="num text-sm">{dateTime(shipment.etaIso)}</span>} />
          <Fact label="Risk" value={<span className="num text-sm font-semibold">{shipment.riskScore}</span>} />
          <Fact label="Mode" value={<span className="text-sm capitalize">{shipment.mode}</span>} />
          <Fact
            label="Decision state"
            value={decision ? <DecisionStateBadge state={decision.overall_status} /> : <span className="text-sm text-muted-foreground">—</span>}
          />
          <Fact
            label="Constraints"
            value={
              shipment.coldChain ? (
                <Badge tone="info">
                  <Snowflake className="h-3 w-3" /> Cold chain
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Standard</span>
              )
            }
          />
        </div>

        {shipment.coldChain && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info/30 bg-info-surface px-3 py-2">
            <Snowflake className="h-4 w-4 text-info" aria-hidden />
            <span className="text-xs font-semibold text-info uppercase">Cold-chain shipment</span>
            <span className="text-xs text-muted-foreground">{shipment.constraints.join(" · ")}</span>
          </div>
        )}

        {/* Stage strip */}
        <div className="panel flex flex-wrap items-center gap-2 px-3 py-2">
          {STAGE_SEQUENCE.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase " +
                  (i < active
                    ? "bg-success-surface text-success"
                    : i === active
                      ? busy
                        ? "bg-info-surface text-info"
                        : "bg-accent text-foreground"
                      : "bg-surface-muted text-muted-foreground")
                }
              >
                {label}
                {busy && i === active ? " …" : ""}
              </span>
              {i < STAGE_SEQUENCE.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
          {run?.decision?.source && (
            <span className="num ml-auto text-[11px] text-muted-foreground">
              Plan made by: {run.decision.sourceNote === "demo" ? "Demo logic" : run.decision.source === "gemini" ? "Gemini runtime (MVP) · trained LLM is target architecture" : "Backup logic"}
              {run.decision.sourceNote ? ` · ${run.decision.sourceNote}` : ""}
            </span>
          )}
        </div>

        {run?.state === "ERROR" && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-surface p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-danger">Could not create a plan</p>
              <p className="text-xs text-muted-foreground">{run.error} Nothing was changed.</p>
            </div>
          </div>
        )}

        {/* SENSE */}
        <Panel title="1 · Sense" subtitle="Check news, weather, ships, and ports" bodyClassName="p-3">
          {run && run.state !== "ERROR" ? (
            <SensePanel event={run.disruption} />
          ) : (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="text-xs text-muted-foreground">
                {run?.state === "ERROR" ? "The last check failed. Try again to reconnect and check the live data." : "This shipment has not been checked yet. We will look at the available live data before making any plan."}
              </p>
              <Button size="sm" disabled={busy || state.systemStatus.backend !== "healthy"} onClick={() => triggerScenario(shipment.id)}>
                {busy ? "Checking live data…" : run?.state === "ERROR" ? "Try live check again" : "Check live data"}
              </Button>
            </div>
          )}
        </Panel>

        {/* DECIDE */}
        <Panel
          title="2 · Simulate and decide"
          subtitle="Compare recovery choices, then select the safest plan"
          bodyClassName="p-3 space-y-3"
        >
          {busy && !decision && (
            <p className="text-xs text-muted-foreground">
              Creating plans and checking the safety rules…
            </p>
          )}
          {!busy && !decision && (
            <p className="text-xs text-muted-foreground">
              {run?.state === "SENSE_COMPLETE" ? "No disruption was confirmed, so no plan was created and nothing was changed." : "Check the shipment to create recovery plans."}
            </p>
          )}
          {decision && (
            <>
              <DecisionComparison decision={decision} />
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="label-xs">Why this plan was chosen</span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{decision.rationale}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <span className="label-xs">Safety checks</span>
                  <ul className="mt-1 space-y-1">
                    {decision.constraint_analysis.map((c) => (
                      <li key={c} className="text-xs leading-snug text-muted-foreground">
                        • {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </Panel>

        {/* ACT */}
        <Panel title="3 · Commit" subtitle="Apply the plan or send it for human review" bodyClassName="p-3 space-y-3">
          {run && run.state === "PENDING_APPROVAL" && <ApprovalPanel run={run} />}
          {run && (run.act || run.state === "REJECTED_ESCALATED") && <ActionResultPanel run={run} />}
          {(!run || (!run.act && run.state !== "PENDING_APPROVAL" && run.state !== "REJECTED_ESCALATED")) && (
            <p className="text-xs text-muted-foreground">Nothing has been changed for this shipment.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 pr-3">
      <p className="label-xs">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}
