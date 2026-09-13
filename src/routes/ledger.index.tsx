import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, DecisionStateBadge, EmptyState, Panel } from "@/components/sf/ui";
import { dateTime } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/ledger/")({
  head: () => ({
    meta: [
      { title: "Decision Ledger — Sentinel Flash" },
      {
        name: "description",
        content:
          "Immutable, read-only audit record of every committed supply-chain recovery decision, its actor and its economics.",
      },
      { property: "og:title", content: "Decision Ledger — Sentinel Flash" },
      {
        property: "og:description",
        content: "Read-only audit trail of committed disruption decisions and their approval path.",
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <LedgerPage />
    </RequireSession>
  ),
});

function LedgerPage() {
  const { state } = useSentinel();
  const entries = [...state.ledger].sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));

  return (
    <AppShell
      title="Decision ledger"
      subtitle="Read-only audit record · seeded history plus this session"
      actions={<Badge tone="neutral">{entries.length} entries</Badge>}
    >
      <div className="p-3">
        <Panel title="Committed decisions" bodyClassName="overflow-x-auto">
          {entries.length === 0 ? (
            <EmptyState title="Ledger is empty" description="Committed decisions are recorded here." />
          ) : (
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {["Timestamp (UTC)", "Reference", "Shipment", "Lane", "Decision", "Status", "Actor", ""].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 font-semibold tracking-wide uppercase">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-accent/50">
                    <td className="num px-3 py-2.5 whitespace-nowrap">{dateTime(e.timestampIso)}</td>
                    <td className="num px-3 py-2.5 whitespace-nowrap text-muted-foreground">{e.reference}</td>
                    <td className="num px-3 py-2.5 font-semibold">{e.shipmentId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{e.lane}</td>
                    <td className="max-w-[320px] truncate px-3 py-2.5">{e.decision}</td>
                    <td className="px-3 py-2.5">
                      <DecisionStateBadge state={e.status} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {e.actorName}
                      <span className="ml-1 text-[11px] text-muted-foreground uppercase">({e.actorType})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to="/ledger/$entryId"
                        params={{ entryId: e.id }}
                        className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
                      >
                        Replay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Entries cannot be edited or deleted from this interface. Seeded history is demo data.
        </p>
      </div>
    </AppShell>
  );
}
