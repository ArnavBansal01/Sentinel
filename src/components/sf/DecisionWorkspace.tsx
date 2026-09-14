import { Ban, CheckCircle2, CircleDot, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { days, usdExact } from "@/lib/sf/format";
import type { CostBreakdown, Decision, DoNothingBaseline, RecoveryOption } from "@/lib/sf/types";
import { Badge } from "./ui";

const TYPE_LABEL: Record<RecoveryOption["type"], string> = {
  reroute: "Reroute",
  respeed: "Re-speed",
  switch_mode: "Switch mode / port",
};

function Row({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("num text-xs font-medium", tone)}>{value}</span>
    </div>
  );
}

function riskTone(risk: number): string {
  if (risk >= 60) return "text-danger";
  if (risk >= 35) return "text-warning";
  return "text-success";
}

function CostDetails({
  breakdown,
  baseline = false,
}: {
  breakdown?: CostBreakdown | undefined;
  baseline?: boolean;
}) {
  if (!breakdown) return null;
  return (
    <div className="mt-3 rounded-md border border-border bg-surface-muted px-2.5 py-2">
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Calculated cost breakdown
      </p>
      {!baseline && (
        <Row
          label={`Fuel @ ${usdExact(breakdown.bunker_fuel_usd_per_tonne)}/t`}
          value={usdExact(breakdown.fuel_usd)}
        />
      )}
      <Row label="Vessel time" value={usdExact(breakdown.vessel_time_usd)} />
      {!baseline && <Row label="Port / handling" value={usdExact(breakdown.handling_usd)} />}
      <Row
        label={baseline ? "Cargo exposure" : "Cargo protection"}
        value={usdExact(breakdown.cargo_protection_usd)}
      />
      <Row label="Risk reserve" value={usdExact(breakdown.risk_reserve_usd)} />
    </div>
  );
}

export function DoNothingCard({ baseline }: { baseline: DoNothingBaseline }) {
  return (
    <article className="flex flex-col rounded-lg border border-dashed border-border-strong bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="label-xs">If we do nothing</span>
        <Badge tone="neutral" dot={false}>
          Comparison
        </Badge>
      </div>
      <h3 className="mt-1 text-sm font-semibold">Do nothing</h3>
      <p className="num mt-2 text-2xl leading-none font-semibold text-foreground">
        {usdExact(baseline.cost_usd)}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{baseline.description}</p>
      <CostDetails breakdown={baseline.cost_breakdown} baseline />
      <div className="mt-3 border-t border-border pt-2">
        <Row label="Extra time" value={days(baseline.days_added)} />
        <Row label="Extra fuel" value="—" />
        <Row
          label="Risk"
          value={String(baseline.risk_score)}
          tone={riskTone(baseline.risk_score)}
        />
        <Row label="Status" value="Used for comparison" />
      </div>
    </article>
  );
}

export function RecoveryOptionCard({
  option,
  decision,
  highlight,
}: {
  option: RecoveryOption;
  decision: Decision;
  highlight?: "recommended" | "committed" | undefined;
}) {
  const refused = option.status === "refused";
  const committed = decision.committed_option_id === option.id;
  const recommended = decision.recommended_option_id === option.id;

  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border bg-surface p-3",
        refused
          ? "border-danger/40 bg-danger-surface/40"
          : committed
            ? "border-success/50"
            : recommended
              ? "border-primary/45"
              : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-xs">{TYPE_LABEL[option.type]}</span>
        {refused ? (
          <Badge tone="danger" dot={false}>
            <Ban className="h-3 w-3" /> Blocked
          </Badge>
        ) : committed ? (
          <Badge tone="success" dot={false}>
            <CheckCircle2 className="h-3 w-3" /> Applied
          </Badge>
        ) : recommended ? (
          <Badge tone="info" dot={false}>
            <CircleDot className="h-3 w-3" /> Best plan
          </Badge>
        ) : (
          <Badge tone="neutral" dot={false}>
            <Minus className="h-3 w-3" /> Allowed
          </Badge>
        )}
      </div>

      <h3 className="mt-1 text-sm leading-snug font-semibold">{option.label}</h3>

      <p
        className={cn(
          "num mt-2 text-2xl leading-none font-semibold",
          refused
            ? "text-danger line-through decoration-danger/70 decoration-2"
            : "text-foreground",
        )}
      >
        {usdExact(option.cost_usd)}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{option.description}</p>

      <CostDetails breakdown={option.cost_breakdown} />

      <div className="mt-3 border-t border-border pt-2">
        <Row label="Extra time" value={days(option.days_added)} />
        <Row
          label="Extra fuel"
          value={`${option.fuel_pct}% · ${Math.round(option.fuel_tonnes)} t`}
        />
        <Row label="Risk" value={String(option.risk_score)} tone={riskTone(option.risk_score)} />
        <Row
          label="Saving vs no action"
          value={usdExact(Math.max(0, decision.do_nothing.cost_usd - option.cost_usd))}
          tone="text-success"
        />
        <Row
          label="Status"
          value={refused ? "Blocked by safety rule" : committed ? "Applied" : "Allowed"}
          tone={refused ? "text-danger" : committed ? "text-success" : undefined}
        />
      </div>

      {refused && (
        <div className="mt-3 rounded-md border border-danger/40 bg-danger-surface p-2.5">
          <div className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5 text-danger" aria-hidden />
            <span className="text-[11px] font-bold tracking-wide text-danger uppercase">
              Blocked for safety · {option.constraint}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-danger">{option.refusal_reason}</p>
          <p className="mt-1.5 text-[10px] text-danger/80">
            The safety rules blocked this plan. Even the AI or an approver cannot force it through.
          </p>
        </div>
      )}
    </article>
  );
}

export function DecisionComparison({ decision }: { decision: Decision }) {
  const ordered = [...decision.options].sort((a, b) => a.cost_usd - b.cost_usd);
  return (
    <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
      <DoNothingCard baseline={decision.do_nothing} />
      {ordered.map((o) => (
        <RecoveryOptionCard key={o.id} option={o} decision={decision} />
      ))}
    </div>
  );
}
