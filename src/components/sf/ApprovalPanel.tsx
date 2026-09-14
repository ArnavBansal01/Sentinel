import { useState } from "react";
import { Check, X, Lock, ShieldCheck } from "lucide-react";

import { useSentinel } from "@/lib/sf/store";
import { approvalReasonLabel, dateTime, usdExact } from "@/lib/sf/format";
import type { WorkflowRun } from "@/lib/sf/types";
import { Badge, Button } from "./ui";

export function ApprovalPanel({ run }: { run: WorkflowRun }) {
  const { state, resolveApproval } = useSentinel();
  const [note, setNote] = useState("");
  const [overrideId, setOverrideId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const decision = run.decision;
  if (!decision || run.state !== "PENDING_APPROVAL") return null;

  const isApprover = state.user?.role === "approver";
  const recommended = decision.options.find((o) => o.id === decision.recommended_option_id);
  const viable = decision.options.filter((o) => o.status === "viable");
  const timedReview = decision.auto_commit_after_review === true;

  const act = async (type: "approve" | "reject" | "override") => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await resolveApproval(
        run.shipmentId,
        type,
        type === "override" ? overrideId : undefined,
        note,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="approval-workbench rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" aria-hidden />
          <span className="text-sm font-semibold">
            {timedReview ? "Two-hour review window" : "Waiting for required human review"}
          </span>
          <Badge tone="warning">{timedReview ? "Auto-commit pending" : "Not applied"}</Badge>
        </div>
        <span className="num break-all text-[10px] text-muted-foreground">
          Decision {decision.id}
        </span>
      </div>

      {timedReview && decision.review_deadline_iso && (
        <p className="mt-2 text-xs text-muted-foreground">
          Change, reject, or approve this plan before{" "}
          <span className="num font-semibold text-foreground">
            {dateTime(decision.review_deadline_iso)}
          </span>
          . If untouched, the recommended plan is applied automatically.
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {decision.approval_reasons.map((r) => (
          <li key={r} className="text-xs text-foreground">
            • {approvalReasonLabel(r)}
          </li>
        ))}
      </ul>

      {recommended && (
        <p className="mt-2 text-xs text-muted-foreground">
          Best plan: <span className="font-medium text-foreground">{recommended.label}</span> ·{" "}
          <span className="num">{usdExact(recommended.cost_usd)}</span>
        </p>
      )}

      {!isApprover ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-muted p-2.5">
          <Lock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            A Planner can view this plan but cannot approve it. Sign in as Approver to make the
            final decision.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <label className="block">
            <span className="label-xs">Review note (saved in decision history)</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did you make this choice?"
              className="mt-2 w-full resize-y rounded-lg border border-input bg-surface-muted px-3 py-3 text-xs leading-5 outline-none focus:border-ring"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="success"
              size="sm"
              disabled={submitting}
              onClick={() => act("approve")}
            >
              <Check size={14} /> Approve best plan
            </Button>
            <Button variant="danger" size="sm" disabled={submitting} onClick={() => act("reject")}>
              <X size={14} /> Reject plan
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
            <label className="label-xs" htmlFor="override-option">
              Choose another plan
            </label>
            <select
              id="override-option"
              value={overrideId}
              onChange={(e) => setOverrideId(e.target.value)}
              className="h-9 min-w-0 max-w-full rounded-lg border border-input bg-surface px-2 text-xs"
            >
              <option value="">Select a viable option…</option>
              {viable
                .filter((o) => o.id !== decision.recommended_option_id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} — {usdExact(o.cost_usd)}
                  </option>
                ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={!overrideId || submitting}
              onClick={() => act("override")}
            >
              Apply this plan
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Blocked plans cannot be selected because they break a safety rule.
            </span>
          </div>
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
