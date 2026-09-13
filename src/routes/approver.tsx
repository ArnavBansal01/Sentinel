import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, EmptyState, Panel } from "@/components/sf/ui";
import { sinceLabel, usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/approver")({
  head: () => ({
    meta: [
      { title: "Approval Queue — Sentinel Flash" },
      {
        name: "description",
        content:
          "Review decisions held above autonomous thresholds: approve, reject or override with a recorded human actor.",
      },
      { property: "og:title", content: "Approval Queue — Sentinel Flash" },
      {
        property: "og:description",
        content: "Human decision authority for high-value and constrained supply-chain recoveries.",
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <ApproverPage />
    </RequireSession>
  ),
});

function ApproverPage() {
  const { state } = useSentinel();
  const pending = Object.values(state.runs).filter((r) => r.state === "PENDING_APPROVAL");
  const resolved = Object.values(state.runs).filter((r) =>
    ["APPROVED_COMMITTED", "OVERRIDDEN_COMMITTED", "REJECTED_ESCALATED"].includes(r.state),
  );
  const isApprover = state.user?.role === "approver";

  return (
    <AppShell
      title="Review decisions"
      subtitle={
        isApprover
          ? "Plans that need a person to approve them"
          : "View only — switch to Approver to make a decision"
      }
      actions={<Badge tone={pending.length ? "warning" : "neutral"}>{pending.length} pending</Badge>}
    >
      <div className="space-y-3 p-3">
        <Panel title="Waiting for review" bodyClassName="overflow-x-auto">
          {pending.length === 0 ? (
            <EmptyState
              title="No decisions awaiting approval"
              description="A plan appears here when its value, delay, fuel use, or temperature risk needs a person to check it."
            />
          ) : (
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {["Shipment", "Route", "Why review is needed", "Cargo value", "Risk", "Waiting", "Best plan", ""].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 font-semibold tracking-wide uppercase">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.map((run) => {
                  const shipment = state.shipments.find((s) => s.id === run.shipmentId)!;
                  const rec = run.decision?.options.find((o) => o.id === run.decision?.recommended_option_id);
                  return (
                    <tr key={run.shipmentId} className="hover:bg-accent/50">
                      <td className="num px-3 py-2.5 font-semibold">{run.shipmentId}</td>
                      <td className="px-3 py-2.5">
                        {shipment.origin.name} → {shipment.destination.name}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5 text-muted-foreground">
                        {run.decision?.approval_reasons[0]}
                      </td>
                      <td className="num px-3 py-2.5">{usdExact(shipment.cargoValueUsd)}</td>
                      <td className="num px-3 py-2.5">{rec?.risk_score ?? shipment.riskScore}</td>
                      <td className="num px-3 py-2.5">{sinceLabel(run.startedAtIso)}</td>
                      <td className="px-3 py-2.5">
                        {rec ? `${rec.label} · ${usdExact(rec.cost_usd)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to="/shipment/$id"
                          params={{ id: run.shipmentId }}
                          className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Finished reviews" bodyClassName="overflow-x-auto">
          {resolved.length === 0 ? (
            <EmptyState title="Nothing resolved yet" />
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {["Shipment", "Result", "Reviewed by", "Applied plan"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resolved.map((run) => {
                  const committed = run.decision?.options.find(
                    (o) => o.id === run.decision?.committed_option_id,
                  );
                  return (
                    <tr key={run.shipmentId}>
                      <td className="num px-3 py-2.5 font-semibold">{run.shipmentId}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={run.state === "REJECTED_ESCALATED" ? "warning" : "success"}>
                          {run.state.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">{run.approval?.actorName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {committed ? committed.label : "None committed"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
