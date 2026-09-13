import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { useSentinel } from "@/lib/sf/store";
import { usdExact } from "@/lib/sf/format";
import type { WorkflowRun } from "@/lib/sf/types";
import { Badge, Button } from "./ui";

export function ApprovalPanel({ run }: { run: WorkflowRun }) {
  const { state, resolveApproval } = useSentinel();
  const [note, setNote] = useState("");
  const [overrideId, setOverrideId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const decision = run.decision;
  if (!decision || run.state !== "PENDING_APPROVAL") return null;

  const isApprover = state.user?.role === "approver";
  const recommended = decision.options.find((o) => o.id === decision.recommended_option_id);
  const viable = decision.options.filter((o) => o.status === "viable");

  const act = (type: "approve" | "reject" | "override") => {
    if (submitting) return;
    setSubmitting(true);
    resolveApproval(run.shipmentId, type, type === "override" ? overrideId : undefined, note);
  };

  return (
    <div className="rounded-lg border border-warning/45 bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" aria-hidden />
          <span className="text-sm font-semibold">Pending human approval</span>
          <Badge tone="warning">Not committed</Badge>
        </div>
        <span className="num text-[11px] text-muted-foreground">Decision {decision.id}</span>
      </div>

      <ul className="mt-2 space-y-1">
        {decision.approval_reasons.map((r) => (
          <li key={r} className="text-xs text-foreground">
            • {r}
          </li>
        ))}
      </ul>

      {recommended && (
        <p className="mt-2 text-xs text-muted-foreground">
          Recommended: <span className="font-medium text-foreground">{recommended.label}</span> ·{" "}
          <span className="num">{usdExact(recommended.cost_usd)}</span>
        </p>
      )}

      {!isApprover ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-muted p-2.5">
          <Lock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Planner role cannot approve, reject or override. This decision requires an Approver. Sign in as
            Approver to action it.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <label className="block">
            <span className="label-xs">Approver note (recorded in the ledger)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rationale for this human decision"
              className="mt-1 w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-ring"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="success" size="sm" disabled={submitting} onClick={() => act("approve")}>
              Approve recommended option
            </Button>
            <Button variant="danger" size="sm" disabled={submitting} onClick={() => act("reject")}>
              Reject &amp; escalate
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
            <label className="label-xs" htmlFor="override-option">
              Override with
            </label>
            <select
              id="override-option"
              value={overrideId}
              onChange={(e) => setOverrideId(e.target.value)}
              className="h-7 rounded-md border border-input bg-surface px-2 text-xs"
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
              Commit override
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Refused options are excluded — hard constraints cannot be overridden.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
