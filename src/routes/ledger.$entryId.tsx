import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BrainCircuit, Clock3, Lock } from "lucide-react";

import { AppShell } from "@/components/sf/AppShell";
import { DecisionComparison } from "@/components/sf/DecisionWorkspace";
import { RequireSession } from "@/components/sf/guard";
import { Badge, DecisionStateBadge, EmptyState, Panel } from "@/components/sf/ui";
import { dateTime } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";
import type { Decision, LedgerEntry } from "@/lib/sf/types";

export const Route = createFileRoute("/ledger/$entryId")({
  head: ({ params }) => ({
    meta: [
      { title: `Ledger entry ${params.entryId} — Sentinel Flash` },
      {
        name: "description",
        content: `Read-only decision replay for ledger entry ${params.entryId}: evidence, options, constraints, actor and outcome.`,
      },
      { property: "og:title", content: `Ledger entry ${params.entryId} — Sentinel Flash` },
      {
        property: "og:description",
        content:
          "Full decision replay: what was known, what was considered, what was committed and by whom.",
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <LedgerDetail />
    </RequireSession>
  ),
});

/** Rebuilds a read-only Decision view object from the immutable ledger snapshot. */
function replayDecision(entry: LedgerEntry): Decision | null {
  const s = entry.snapshot;
  if (!s) return null;
  return {
    id: entry.id,
    requestId: entry.reference,
    shipmentId: entry.shipmentId,
    generatedAtIso: entry.timestampIso,
    source: entry.decisionSource,
    options: s.options,
    do_nothing: s.do_nothing,
    recommended_option_id: s.recommended_option_id,
    committed_option_id: entry.status === "REJECTED_ESCALATED" ? null : s.recommended_option_id,
    overall_status: entry.status,
    rationale: entry.rationale,
    constraint_analysis: s.constraint_analysis,
    approval_reasons: s.approval_reasons,
    refusals: s.options
      .filter((o) => o.status === "refused")
      .map((o) => ({
        optionId: o.id,
        reason: o.refusal_reason ?? "",
        constraint: o.constraint ?? "",
      })),
  };
}

function LedgerDetail() {
  const { entryId } = Route.useParams();
  const { state } = useSentinel();
  const entry = state.ledger.find((e) => e.id === entryId);
  const shipment = entry ? state.shipments.find((s) => s.id === entry.shipmentId) : undefined;

  if (!entry) {
    return (
      <AppShell title="Ledger entry not found">
        <div className="p-6">
          <EmptyState
            title="Unknown reference"
            description="No ledger entry matches this identifier."
          />
        </div>
      </AppShell>
    );
  }

  const replay = replayDecision(entry);

  return (
    <AppShell
      title={`Ledger entry ${entry.reference}`}
      subtitle="Full decision details · read only"
      actions={
        <Link
          to="/ledger"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Ledger
        </Link>
      }
    >
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">
            This saved record cannot be changed. It shows exactly what the system knew and did.
          </span>
        </div>

        <div className="panel grid grid-cols-2 gap-y-3 px-4 py-3 md:grid-cols-3 xl:grid-cols-6">
          <Fact label="Reference" value={<span className="num text-sm">{entry.reference}</span>} />
          <Fact
            label="Timestamp (UTC)"
            value={<span className="num text-sm">{dateTime(entry.timestampIso)}</span>}
          />
          <Fact
            label="Shipment"
            value={
              <Link
                to="/shipment/$id"
                params={{ id: entry.shipmentId }}
                className="num text-sm font-semibold underline-offset-2 hover:underline"
              >
                {entry.shipmentId}
              </Link>
            }
          />
          <Fact label="Status" value={<DecisionStateBadge state={entry.status} />} />
          <Fact
            label="Actor"
            value={
              <span className="text-sm">
                {entry.actorName}{" "}
                <span className="text-[11px] text-muted-foreground uppercase">
                  ({entry.actorType})
                </span>
              </span>
            }
          />
          <Fact
            label="Plan made by"
            value={
              <Badge tone={entry.decisionSource === "gemini" ? "info" : "neutral"}>
                {entry.decisionSource === "gemini" ? "Gemini AI" : "Demo or backup logic"}
              </Badge>
            }
          />
        </div>

        <Panel title="Chosen plan" bodyClassName="p-3 space-y-2">
          <div className="flex items-center gap-2 text-success">
            <BrainCircuit className="h-4 w-4" />
            <span className="label-xs text-success">Why this plan was chosen</span>
          </div>
          <p className="text-sm font-medium">{entry.decision}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{entry.rationale}</p>
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            <Fact label="Lane" value={<span className="text-sm">{entry.lane}</span>} />
            <Fact
              label="Cargo"
              value={
                <span className="text-sm">
                  {shipment ? shipment.cargo : "Not in current scope"}
                </span>
              }
            />
          </div>
        </Panel>

        {replay ? (
          <>
            {entry.snapshot?.evidence?.length ? (
              <Panel title="Data used for this decision" bodyClassName="p-3">
                <ul className="grid gap-2 md:grid-cols-2">
                  {entry.snapshot.evidence.map((e) => (
                    <li key={e.id} className="rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="num text-[11px] text-muted-foreground">{e.connector}</span>
                        <Badge tone={e.dataStatus === "LIVE" ? "success" : "warning"}>
                          {e.dataStatus === "LIVE" ? "Live signal" : e.dataStatus === "UNAVAILABLE" ? "Unavailable" : "Demo signal"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-medium">{e.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.publisher} · {dateTime(e.observedAtIso)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
            <Panel title="Plans compared" bodyClassName="p-3">
              <DecisionComparison decision={replay} />
            </Panel>
            {entry.snapshot?.logs?.length ? (
              <Panel
                title="Step-by-step system log"
                subtitle={`Run ID ${entry.snapshot.traceId}`}
                bodyClassName="p-3"
              >
                <ol className="space-y-2">
                  {entry.snapshot.logs.map((log) => (
                    <li
                      key={log.id}
                      className="flex gap-3 rounded-lg border border-border bg-surface-muted/50 p-3"
                    >
                      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <div>
                        <p className="text-xs font-semibold">{log.type}</p>
                        <p className="text-[11px] text-muted-foreground">{log.message}</p>
                        <p className="num mt-1 text-[9px] text-muted-foreground">
                          {dateTime(log.atIso)} · {log.stage.toUpperCase()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            ) : null}
            {entry.snapshot?.approval && (
              <Panel title="Human decision" bodyClassName="p-3">
                <p className="text-sm">
                  <span className="font-medium capitalize">{entry.snapshot.approval.type}</span> by{" "}
                  {entry.snapshot.approval.actorName} ·{" "}
                  <span className="num">{dateTime(entry.snapshot.approval.atIso)}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.snapshot.approval.note}</p>
              </Panel>
            )}
          </>
        ) : (
          <Panel title="Replay" bodyClassName="p-3">
            <p className="text-xs text-muted-foreground">
              This entry is seeded historical demo data without a retained option snapshot, so only
              the committed summary above is available.
            </p>
          </Panel>
        )}
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
