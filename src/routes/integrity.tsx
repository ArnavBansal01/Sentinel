import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Snowflake, Thermometer } from "lucide-react";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, EmptyState, Panel } from "@/components/sf/ui";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/integrity")({ component: () => <RequireSession><IntegrityPage /></RequireSession> });

function IntegrityPage() {
  const { state } = useSentinel();
  const shipments = state.shipments.filter((s) => s.coldChain);
  return <AppShell title="Temperature safety" subtitle="Protect temperature-controlled cargo">
    <div className="space-y-3 p-3">
      <div className="grid gap-3 md:grid-cols-3"><Summary icon={Snowflake} label="Protected loads" value={String(shipments.length)} /><Summary icon={ShieldCheck} label="Refused unsafe options" value={String(Object.values(state.runs).reduce((n, run) => n + (run.decision?.refusals.length ?? 0), 0))} /><Summary icon={Thermometer} label="Sensor feed" value="Not configured" warning /></div>
      <div className="rounded-lg border border-info/30 bg-info-surface p-3 text-xs text-muted-foreground"><strong className="text-info">Safety rules are checked before any plan is applied.</strong> Temperature sensor data is not connected yet, so the site will never pretend that it is live. The saved temperature and handling rules are still enforced.</div>
      <Panel title="Temperature-controlled shipments" subtitle="See their safety rules and blocked plans">
        {shipments.length === 0 ? <EmptyState title="No cold-chain shipments" /> : <div className="grid gap-3 p-3 lg:grid-cols-2">{shipments.map((s) => { const run = state.runs[s.id]; const liveEvidence = run?.disruption.sources.filter((e) => e.dataStatus === "LIVE").length ?? 0; return <Link key={s.id} to="/shipment/$id" params={{ id: s.id }} className="rounded-lg border border-border bg-surface-muted p-4 hover:border-info/60"><div className="flex items-center justify-between"><span className="num font-semibold">{s.id}</span><Badge tone={run?.decision?.refusals.length ? "warning" : "info"}>{run ? `${liveEvidence}/${run.disruption.sources.length} live evidence` : "Awaiting verification"}</Badge></div><p className="mt-1 text-sm">{s.origin.name} → {s.destination.name}</p><p className="mt-1 text-xs text-muted-foreground">{s.cargo}</p><ul className="mt-3 space-y-1 border-t border-border pt-3">{s.constraints.map((c) => <li key={c} className="text-xs">✓ {c}</li>)}</ul>{run?.decision?.refusals.map((r) => <p key={r.optionId} className="mt-2 rounded bg-warning-surface p-2 text-xs text-warning">Refused: {r.reason}</p>)}</Link>; })}</div>}
      </Panel>
    </div>
  </AppShell>;
}

function Summary({ icon: Icon, label, value, warning = false }: { icon: typeof Snowflake; label: string; value: string; warning?: boolean }) { return <div className="panel flex items-center gap-3 p-4"><span className={`rounded-lg p-2 ${warning ? "bg-warning-surface text-warning" : "bg-info-surface text-info"}`}><Icon className="h-5 w-5" /></span><div><p className="label-xs">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>; }
