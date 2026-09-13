import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ActivityFeed } from "@/components/sf/ActivityFeed";
import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { ShipmentList } from "@/components/sf/ShipmentList";
import { Badge, EmptyState, Metric, Panel } from "@/components/sf/ui";
import { WorldMap } from "@/components/sf/WorldMap";
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
  { key: "sense", label: "Sense", note: "Signals correlated and verified" },
  { key: "decide", label: "Decide", note: "Options evaluated vs. inaction" },
  { key: "act", label: "Act", note: "Committed or held for approval" },
] as const;

function PlannerPage() {
  const { state } = useSentinel();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  const runs = Object.values(state.runs);
  const disrupted = state.shipments.filter((s) => s.status === "disrupted" || s.status === "pending_approval");
  const pending = runs.filter((r) => r.state === "PENDING_APPROVAL");
  const autonomous = runs.filter((r) => r.state === "AUTO_COMMITTED");
  const atRisk = disrupted.reduce((sum, s) => sum + s.cargoValueUsd, 0);

  const stageCounts = useMemo(
    () => ({
      sense: state.activity.filter((e) => e.stage === "sense").length,
      decide: state.activity.filter((e) => e.stage === "decide" || e.stage === "validate").length,
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
      title="Control tower"
      subtitle="Monitored network · seeded operational data"
      actions={
        pending.length > 0 ? <Badge tone="warning">{pending.length} awaiting approval</Badge> : undefined
      }
    >
      <div className="flex min-h-full flex-col gap-3 p-3">
        <div className="panel grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="Monitored shipments" value={String(state.shipments.length)} hint="Seeded network" />
          <Metric
            label="Active disruptions"
            value={String(disrupted.length)}
            tone={disrupted.length ? "danger" : "neutral"}
            hint="Verified signals"
          />
          <Metric
            label="Pending approval"
            value={String(pending.length)}
            tone={pending.length ? "warning" : "neutral"}
            hint="Above autonomous thresholds"
          />
          <Metric
            label="Autonomous decisions"
            value={String(autonomous.length)}
            tone={autonomous.length ? "success" : "neutral"}
            hint="This session"
          />
          <Metric label="At-risk cargo value" value={usd(atRisk)} hint="Disrupted shipments" />
        </div>

        <div className="panel flex flex-wrap items-center gap-2 px-3 py-2">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="flex items-baseline gap-2 rounded-md bg-surface-muted px-2.5 py-1">
                <span className="label-xs text-foreground/80">{s.label}</span>
                <span className="num text-xs font-semibold">{stageCounts[s.key]}</span>
                <span className="hidden text-[11px] text-muted-foreground lg:inline">{s.note}</span>
              </div>
              {i < STAGES.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Stage counters derive from real workflow events.
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[310px_minmax(0,1fr)_360px]">
          <Panel
            title="Operational activity"
            subtitle="Sense → Decide → Act"
            className="max-h-[560px] xl:max-h-none"
            bodyClassName="overflow-hidden flex"
          >
            {state.activity.length === 0 ? (
              <EmptyState title="No activity recorded" description="Trigger a scenario to begin." />
            ) : (
              <ActivityFeed events={state.activity} />
            )}
          </Panel>

          <Panel
            title="Network map"
            subtitle="Seeded positions and routes — not live AIS"
            className="min-h-[360px]"
            bodyClassName="p-0"
          >
            <WorldMap
              shipments={state.shipments}
              affectedIds={disrupted.map((s) => s.id)}
              selectedId={hovered}
              onSelect={(id) => navigate({ to: "/shipment/$id", params: { id } })}
            />
          </Panel>

          <Panel
            title="Shipments &amp; exceptions"
            subtitle={`${state.shipments.length} shipments in scope`}
            className="max-h-[620px] xl:max-h-none"
            bodyClassName="overflow-hidden flex"
          >
            <ShipmentList shipments={ordered} onHover={setHovered} />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
