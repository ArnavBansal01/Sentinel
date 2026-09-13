import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileJson, Sheet } from "lucide-react";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, Button, DecisionStateBadge, EmptyState, Panel } from "@/components/sf/ui";
import { dateTime } from "@/lib/sf/format";
import { downloadLedger, useSentinel } from "@/lib/sf/store";

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
      title="Decision history"
      subtitle={state.systemStatus.mode === "LIVE" ? "A saved record of every applied decision" : "Saved demo decisions, clearly labeled"}
      actions={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{entries.length} entries</Badge>
          <Button size="sm" variant="outline" onClick={() => void downloadLedger("csv")}>
            <Sheet className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={() => void downloadLedger("json")}>
            <FileJson className="h-3.5 w-3.5" />
            Download JSON
          </Button>
        </div>
      }
    >
      <div className="p-3">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <AuditMetric
            label="Saved decisions"
            value={String(entries.length)}
            note="Records cannot be edited"
          />
          <AuditMetric
            label="Reasons saved"
            value="100%"
            note="Why this plan was chosen"
          />
          <AuditMetric
            label="Steps saved"
            value="Full"
            note="Data, safety checks, and actions"
          />
        </div>
        <Panel
          title="All applied decisions"
          subtitle="Open any row to see the full reason and steps"
          actions={<Download className="h-4 w-4 text-muted-foreground" />}
          bodyClassName="overflow-x-auto"
        >
          {entries.length === 0 ? (
            <EmptyState
              title="Ledger is empty"
              description="Committed decisions are recorded here."
            />
          ) : (
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {[
                    "Timestamp (UTC)",
                    "Reference",
                    "Shipment",
                    "Lane",
                    "Decision",
                    "Status",
                    "Actor",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-accent/50">
                    <td className="num px-3 py-2.5 whitespace-nowrap">
                      {dateTime(e.timestampIso)}
                    </td>
                    <td className="num px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {e.reference}
                    </td>
                    <td className="num px-3 py-2.5 font-semibold">{e.shipmentId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {e.lane}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2.5">{e.decision}</td>
                    <td className="px-3 py-2.5">
                      <DecisionStateBadge state={e.status} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {e.actorName}
                      <span className="ml-1 text-[11px] text-muted-foreground uppercase">
                        ({e.actorType})
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to="/ledger/$entryId"
                        params={{ entryId: e.id }}
                        className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <p className="mt-2 text-[11px] text-muted-foreground">
          These records cannot be edited or deleted here. {state.systemStatus.mode === "LIVE" ? "Every row comes from the backend." : "Demo records are clearly marked."}
        </p>
      </div>
    </AppShell>
  );
}

function AuditMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-surface to-surface-muted p-4">
      <p className="label-xs">{label}</p>
      <p className="num mt-2 text-2xl font-semibold text-success">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
