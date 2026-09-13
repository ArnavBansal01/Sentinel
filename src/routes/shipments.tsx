import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, EmptyState, Panel, ShipmentStatusBadge } from "@/components/sf/ui";
import { dateTime, usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/shipments")({
  component: () => <RequireSession><ShipmentsPage /></RequireSession>,
});

function ShipmentsPage() {
  const { state } = useSentinel();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => state.shipments.filter((shipment) => {
    const haystack = `${shipment.id} ${shipment.origin.name} ${shipment.destination.name} ${shipment.cargo} ${shipment.vessel}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "all" || shipment.status === status);
  }), [state.shipments, query, status]);

  return <AppShell title="Shipments" subtitle="Search and open any shipment">
    <div className="space-y-3 p-3">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input aria-label="Search shipments" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, lane, cargo, vessel…" className="h-9 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-surface px-3 text-sm">
          <option value="all">All statuses</option>{[...new Set(state.shipments.map((s) => s.status))].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
        </select>
        <Badge tone="info">{rows.length} shown</Badge>
      </div>
      <Panel title="All shipments" subtitle="Open one to check live data and create a recovery plan" bodyClassName="overflow-x-auto">
        {rows.length === 0 ? <EmptyState title="No shipments match" description="Try a broader search or status filter." /> : <table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr>{["Shipment", "Lane", "Cargo", "Mode / asset", "Value", "ETA", "Risk", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((s) => <tr key={s.id} className="hover:bg-accent/40"><td className="num px-3 py-3 font-semibold">{s.id}{s.coldChain && <Snowflake className="ml-1 inline h-3 w-3 text-info" />}</td><td className="px-3 py-3">{s.origin.name} → {s.destination.name}</td><td className="px-3 py-3 text-muted-foreground">{s.cargo}</td><td className="px-3 py-3 capitalize">{s.mode} · {s.vessel}</td><td className="num px-3 py-3">{usdExact(s.cargoValueUsd)}</td><td className="num px-3 py-3">{dateTime(s.etaIso)}</td><td className="num px-3 py-3 font-semibold">{s.riskScore}</td><td className="px-3 py-3"><ShipmentStatusBadge status={s.status} /></td><td className="px-3 py-3 text-right"><Link to="/shipment/$id" params={{ id: s.id }} className="rounded-md border border-border px-2 py-1 font-semibold hover:bg-accent">Open</Link></td></tr>)}</tbody></table>}
      </Panel>
    </div>
  </AppShell>;
}
