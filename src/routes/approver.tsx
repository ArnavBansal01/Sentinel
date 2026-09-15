import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, Search, ShieldCheck, UserCheck } from "lucide-react";
import { ApprovalPanel } from "@/components/sf/ApprovalPanel";
import { useEffect, useState } from "react";

import { WorkspaceIntro } from "@/components/sf/OverviewHero";
import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, EmptyState, Metric, Panel } from "@/components/sf/ui";
import { approvalReasonLabel, sinceLabel, usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

function ReviewWindow({ deadlineIso }: { deadlineIso: string | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadlineIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadlineIso]);

  if (!deadlineIso) return <span className="text-warning">Manual approval required</span>;
  const remaining = Math.max(0, Date.parse(deadlineIso) - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span className="text-[10px] font-semibold tracking-wide text-primary uppercase">
      {remaining > 0
        ? `Approve or change within ${hours}h ${minutes}m ${seconds}s, or auto-commit`
        : "Review window ended · auto-commit starting…"}
    </span>
  );
}

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
  const [query, setQuery] = useState("");
  const [reviewType, setReviewType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pending = Object.values(state.runs).filter((r) => r.state === "PENDING_APPROVAL");
  const resolved = Object.values(state.runs).filter((r) =>
    ["APPROVED_COMMITTED", "OVERRIDDEN_COMMITTED", "REJECTED_ESCALATED"].includes(r.state),
  );
  const isApprover = state.user?.role === "approver";
  const required = pending.filter((r) => !r.decision?.auto_commit_after_review);
  const visible = pending.filter((run) => {
    const shipment = state.shipments.find((s) => s.id === run.shipmentId);
    return (
      [run.shipmentId, shipment?.origin.name, shipment?.destination.name]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (reviewType === "all" ||
        (reviewType === "required"
          ? !run.decision?.auto_commit_after_review
          : run.decision?.auto_commit_after_review))
    );
  });
  const selected = visible.find((r) => r.shipmentId === selectedId) ?? visible[0];
  const selectedShipment = state.shipments.find((s) => s.id === selected?.shipmentId);
  const recommendation = selected?.decision?.options.find(
    (o) => o.id === selected.decision?.recommended_option_id,
  );
  const exposure = pending.reduce(
    (total, run) =>
      total + (state.shipments.find((s) => s.id === run.shipmentId)?.cargoValueUsd ?? 0),
    0,
  );

  return (
    <AppShell
      title={isApprover ? "Approver workspace" : "Review decisions"}
      subtitle={
        isApprover
          ? "Change system plans during their two-hour window or review safety-gated plans"
          : "View only — switch to Approver to change a plan"
      }
      actions={
        <Badge tone={pending.length ? "warning" : "neutral"}>{pending.length} pending</Badge>
      }
    >
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        <WorkspaceIntro
          eyebrow="HUMAN OVERSIGHT"
          title="Your judgment. Fully informed."
          description="Review the evidence, weigh the alternatives, and authorize the next move."
        />
        <div className="review-role-strip">
          <span className="review-role-icon">
            <UserCheck size={19} />
          </span>
          <div>
            <strong>
              {isApprover
                ? state.user?.name + " · Decision authority"
                : "Planner · Read-only access"}
            </strong>
            <p>
              {isApprover
                ? "Your approvals, rejections, and overrides are recorded in decision history."
                : "Inspect the evidence and recommendations. An Approver authorizes the final action."}
            </p>
          </div>
          <Badge tone={isApprover ? "success" : "neutral"}>
            {isApprover ? "Approver access" : "View only"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric
            label="Pending reviews"
            value={String(pending.length)}
            hint="Awaiting a decision"
            tone={pending.length ? "warning" : "neutral"}
          />
          <Metric
            label="Required approvals"
            value={String(required.length)}
            hint="No automatic commitment"
          />
          <Metric
            label="Cargo under review"
            value={usdExact(exposure)}
            hint="Value across pending shipments"
          />
          <Metric
            label="Completed reviews"
            value={String(resolved.length)}
            hint="Human-reviewed outcomes"
            tone="success"
          />
        </div>
        <div className="review-section-title">
          <div>
            <p className="label-xs">DECISION QUEUE</p>
            <h2>Focus on the next move.</h2>
          </div>
          <span>
            <Clock3 size={14} /> Timed reviews show their deadline
          </span>
        </div>
        <div className="review-toolbar">
          <label>
            <Search size={15} />
            <input
              aria-label="Search reviews"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shipment or route…"
            />
          </label>
          <div role="group" aria-label="Review type">
            {[
              ["all", "All reviews"],
              ["required", "Required approval"],
              ["timed", "Timed review"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={reviewType === value}
                onClick={() => setReviewType(value ?? "all")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Panel
          title="Waiting for review"
          actions={<Badge tone="neutral">{visible.length} shown</Badge>}
          bodyClassName="overflow-x-auto"
        >
          {visible.length === 0 ? (
            <EmptyState
              title={pending.length ? "No matching reviews" : "Your review queue is clear"}
              description={
                pending.length
                  ? "Try another shipment, route, or review type."
                  : "New decisions will appear here when a plan needs your attention."
              }
            />
          ) : (
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {[
                    "Shipment",
                    "Route",
                    "Why review is needed",
                    "Cargo value",
                    "Risk",
                    "Best plan",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((run) => {
                  const shipment = state.shipments.find((s) => s.id === run.shipmentId);
                  const rec = run.decision?.options.find(
                    (o) => o.id === run.decision?.recommended_option_id,
                  );
                  return (
                    <tr
                      key={run.shipmentId}
                      className={
                        selected?.shipmentId === run.shipmentId
                          ? "review-selected-row"
                          : "hover:bg-accent/50"
                      }
                    >
                      <td className="num px-3 py-2.5 font-semibold">{run.shipmentId}</td>
                      <td className="px-3 py-2.5">
                        {shipment?.origin.name ?? "Unknown"} →{" "}
                        {shipment?.destination.name ?? "Unknown"}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5 text-muted-foreground">
                        {(run.decision?.approval_reasons[0]
                          ? approvalReasonLabel(run.decision.approval_reasons[0])
                          : undefined) ??
                          (run.decision?.auto_commit_after_review
                            ? "Optional two-hour approver review"
                            : "Policy requires human approval")}
                      </td>
                      <td className="num px-3 py-2.5">{usdExact(shipment?.cargoValueUsd ?? 0)}</td>
                      <td className="num px-3 py-2.5">
                        {rec?.risk_assessment
                          ? `Tier ${rec.risk_assessment.tier} · ${rec.risk_assessment.label}`
                          : (rec?.risk_score ?? shipment?.riskScore ?? "—")}
                      </td>
                      <td className="px-3 py-2.5">
                        {rec ? `${rec.label} · ${usdExact(rec.cost_usd)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex min-w-[250px] flex-col items-end gap-2">
                          {run.decision?.auto_commit_after_review ? (
                            <ReviewWindow deadlineIso={run.decision.review_deadline_iso} />
                          ) : (
                            <span
                              className="text-[10px] font-semibold tracking-wide text-warning uppercase"
                              title={`Waiting ${sinceLabel(run.startedAtIso)}`}
                            >
                              Human approval required · no auto-commit
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedId(run.shipmentId)}
                            aria-pressed={selected?.shipmentId === run.shipmentId}
                            className="review-inspect-button"
                          >
                            {selected?.shipmentId === run.shipmentId
                              ? "Selected for review"
                              : "Inspect decision"}
                            <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {selected && (
          <section className="review-detail-grid" aria-label="Selected decision">
            <Panel
              title="Decision brief"
              actions={<Badge tone="info">{selected.shipmentId}</Badge>}
              bodyClassName="p-5"
            >
              <p className="label-xs">
                {selectedShipment?.origin.name ?? "Origin"} →{" "}
                {selectedShipment?.destination.name ?? "Destination"}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                {recommendation?.label ?? "Recommendation pending"}
              </h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {recommendation?.description ??
                  "Open the shipment to inspect the available evidence."}
              </p>
              {recommendation?.guidance && (
                <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                  <p className="label-xs text-primary">
                    {recommendation.type === "port_switch" ? "EXACT ALTERNATE PORT" : "EXACT ROUTE"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{recommendation.guidance.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {recommendation.guidance.route_text}
                  </p>
                  {recommendation.guidance.onward_leg && (
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      After discharge: {recommendation.guidance.onward_leg}
                    </p>
                  )}
                </div>
              )}
              <div className="decision-brief-stats">
                <div>
                  <span>Estimated cost</span>
                  <strong>{recommendation ? usdExact(recommendation.cost_usd) : "—"}</strong>
                </div>
                <div>
                  <span>Added time</span>
                  <strong>{recommendation ? recommendation.days_added + " days" : "—"}</strong>
                </div>
              </div>
              <div className="flex gap-2 rounded-lg bg-accent p-3 text-xs leading-5 text-primary">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                {selected.decision?.options.filter((o) => o.status === "viable").length ?? 0} viable
                options · {selected.decision?.refusals.length ?? 0} safety refusals
              </div>
              {recommendation?.risk_assessment && (
                <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                  <span className="label-xs">Risk decision</span>
                  <p className="mt-1 text-sm font-semibold">
                    Tier {recommendation.risk_assessment.tier} ·{" "}
                    {recommendation.risk_assessment.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Score {recommendation.risk_assessment.score}/18 ·{" "}
                    {recommendation.risk_assessment.behavior.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
              )}
              <Link
                to="/shipment/$id"
                params={{ id: selected.shipmentId }}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary"
              >
                Open evidence and all alternatives <ArrowUpRight size={14} />
              </Link>
            </Panel>
            <ApprovalPanel key={selected.shipmentId} run={selected} />
          </section>
        )}
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
