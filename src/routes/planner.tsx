import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ActivityFeed } from "@/components/sf/ActivityFeed";
import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { ShipmentList } from "@/components/sf/ShipmentList";
import { Badge, EmptyState, Metric, Panel } from "@/components/sf/ui";
import { LiveMap } from "@/components/sf/LiveMap";
import { usd } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Control Tower — Sentinel Flash" },
      {
        name: "description",
        content:
          "Monitor shipments, verified disruption signals and autonomous recovery decisions in the Sentinel Flash control tower.",
      },
      { property: "og:title", content: "Control Tower — Sentinel Flash" },
      {
        property: "og:description",
        content: "Live operational view of monitored shipments, disruptions and decisions.",
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <PlannerPage />
    </RequireSession>
  ),
});

const STAGES = [
  { key: "sense", label: "Sense", note: "Read the available data" },
  { key: "simulate", label: "Simulate", note: "Build recovery choices" },
  { key: "decide", label: "Decide", note: "Check rules and choose" },
  { key: "act", label: "Commit", note: "Apply or ask a person" },
] as const;

function PlannerPage() {
  const { state } = useSentinel();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  const runs = Object.values(state.runs);
  const disrupted = state.shipments.filter(
    (s) => s.status === "disrupted" || s.status === "pending_approval",
  );
  const pending = runs.filter((r) => r.state === "PENDING_APPROVAL");
  const autonomous = runs.filter((r) => r.state === "AUTO_COMMITTED");
  const atRisk = disrupted.reduce((sum, s) => sum + s.cargoValueUsd, 0);

  const stageCounts = useMemo(
    () => ({
      sense: state.activity.filter((e) => e.stage === "sense").length,
      simulate: state.activity.filter((e) => e.stage === "decide").length,
      decide: state.activity.filter((e) => e.stage === "validate").length,
      act: state.activity.filter((e) => e.stage === "act").length,
    }),
    [state.activity],
  );

  const ordered = [...state.shipments].sort((a, b) => {
    const rank = (s: (typeof state.shipments)[number]) =>
      s.status === "pending_approval" ? 0 : s.status === "disrupted" ? 1 : s.demoScenario ? 2 : 3;
    return rank(a) - rank(b) || b.riskScore - a.riskScore;
  });

  return (
    <AppShell
      title="Live overview"
      subtitle={`${state.systemStatus.mode} data mode · updates and saved decisions`}
      actions={
        pending.length > 0 ? (
          <Badge tone="warning">{pending.length} awaiting approval</Badge>
        ) : undefined
      }
    >
      <div className="flex min-h-full flex-col gap-5 p-4 sm:p-5 lg:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
          <Metric
            label="Shipments watched"
            value={String(state.shipments.length)}
            hint="Saved in the system"
          />
          <Metric
            label="Problems found"
            value={String(disrupted.length)}
            tone={disrupted.length ? "danger" : "neutral"}
            hint="Confirmed by data"
          />
          <Metric
            label="Waiting for review"
            value={String(pending.length)}
            tone={pending.length ? "warning" : "neutral"}
            hint="A person must decide"
          />
          <Metric
            label="Auto decisions"
            value={String(autonomous.length)}
            tone={autonomous.length ? "success" : "neutral"}
            hint="Applied automatically"
          />
          <Metric label="Cargo value at risk" value={usd(atRisk)} hint="Shipments with problems" />
        </div>

        <div className="panel grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className="workflow-step relative flex min-w-0 items-center gap-3 rounded-lg border border-transparent bg-surface-muted px-3 py-2.5 transition-colors hover:border-border-strong"
            >
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/25 bg-success-surface text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="label-xs block text-foreground/90">{s.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{s.note}</span>
              </div>
              <span className="num rounded-md bg-surface px-2 py-1 text-xs font-semibold shadow-sm">
                {stageCounts[s.key]}
              </span>
              {i < STAGES.length - 1 && (
                <span className="absolute -right-2.5 z-10 hidden text-muted-foreground xl:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(480px,1.25fr)] 2xl:grid-cols-[290px_minmax(520px,1fr)_350px]">
          <Panel
            title="What the system is doing"
            subtitle="Sense → Simulate → Decide → Commit"
            actions={
              <Badge
                tone={state.systemStatus.backend === "healthy" ? "success" : "danger"}
                className={state.systemStatus.backend === "healthy" ? "status-live" : ""}
              >
                {state.systemStatus.backend === "healthy" ? "LIVE UPDATES" : "OFFLINE"}
              </Badge>
            }
            className="max-h-[560px] xl:max-h-[620px]"
            bodyClassName="overflow-hidden flex"
          >
            {state.activity.length === 0 ? (
              <EmptyState title="No updates yet" description="Run a demo or check a shipment." />
            ) : (
              <ActivityFeed events={state.activity} />
            )}
          </Panel>

          <Panel
            title="Network map"
            subtitle="Drag to move · scroll to zoom · select a ship"
            className="min-h-0 self-start"
            bodyClassName="p-0 aspect-[2/1] min-h-[320px] max-h-[540px] flex-none"
          >
            <LiveMap
              shipments={state.shipments}
              affectedIds={disrupted.map((s) => s.id)}
              selectedId={hovered}
              onSelect={(id) => navigate({ to: "/shipment/$id", params: { id } })}
            />
          </Panel>

          <Panel
            title="Shipments needing attention"
            subtitle={`${state.shipments.length} shipments being watched`}
            className="max-h-[620px] xl:col-span-2 xl:max-h-[620px] 2xl:col-span-1"
            bodyClassName="overflow-hidden flex"
          >
            <ShipmentList shipments={ordered} onHover={setHovered} />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
