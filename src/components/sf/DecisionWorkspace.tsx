import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  MapPin,
  Minus,
  Route as RouteIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { days, usdExact } from "@/lib/sf/format";
import type { CostBreakdown, Decision, DoNothingBaseline, RecoveryOption } from "@/lib/sf/types";
import { Badge } from "./ui";

const TYPE_LABEL: Record<RecoveryOption["type"], string> = {
  reroute: "Reroute",
  respeed: "Re-speed",
  port_switch: "Port switch",
  hold_and_wait: "Hold and wait",
  accept_loss: "Accept loss",
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
        Modelled estimate breakdown
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

function RiskDetails({ option }: { option: RecoveryOption }) {
  const risk = option.risk_assessment;
  if (!risk) return null;
  const tone =
    risk.tier === 4 ? "danger" : risk.tier === 3 ? "warning" : risk.tier === 2 ? "info" : "success";
  return (
    <div className="mt-3 rounded-md border border-border bg-surface-muted px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Explainable risk factors
        </p>
        <Badge tone={tone}>
          Tier {risk.tier} · {risk.label}
        </Badge>
      </div>
      <div className="mt-2 space-y-1.5">
        {risk.criteria.map((item) => (
          <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px]">
            <span className="min-w-0 text-muted-foreground">
              {item.label} · {item.detail}
            </span>
            <span
              className={cn(
                "num font-semibold",
                item.score >= 3
                  ? "text-danger"
                  : item.score >= 2
                    ? "text-warning"
                    : "text-foreground",
              )}
            >
              {item.included_in_total ? `${item.score}/3` : item.score ? "Gate" : "Clear"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[10px]">
        <span className="font-semibold text-foreground">Scored total</span>
        <span className="num font-semibold">{risk.score}/18</span>
      </div>
      {risk.hard_overrides.map((override) => (
        <p key={override} className="mt-1 text-[10px] leading-snug text-danger">
          • {override}
        </p>
      ))}
    </div>
  );
}

function RecoveryGuidance({ option }: { option: RecoveryOption }) {
  const guidance = option.guidance;
  if (!guidance) return null;
  const isPortSwitch = option.type === "port_switch";
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        {isPortSwitch ? (
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-wide text-primary uppercase">
            {isPortSwitch ? "Exact alternate port" : "Recommended sailing route"}
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground">{guidance.title}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-5 font-medium text-foreground">
        {guidance.route_text}
      </p>
      {guidance.onward_leg && (
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">After discharge:</span>{" "}
          {guidance.onward_leg}
        </p>
      )}
      <ol className="mt-2 space-y-1 border-t border-primary/15 pt-2">
        {guidance.steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-[10px] leading-4 text-muted-foreground">
            <span className="num font-semibold text-primary">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {guidance.confirmation_required && (
        <p className="mt-2 text-[9px] leading-4 font-semibold tracking-wide text-warning uppercase">
          Planning route · confirm berth, capacity, navigation and carrier acceptance before apply
        </p>
      )}
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
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
        Planning estimate
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
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs">{TYPE_LABEL[option.type]}</span>
        <div className="flex flex-wrap justify-end gap-1">
          {option.risk_assessment && (
            <Badge
              tone={
                option.risk_assessment.tier >= 4
                  ? "danger"
                  : option.risk_assessment.tier >= 3
                    ? "warning"
                    : option.risk_assessment.tier === 2
                      ? "info"
                      : "success"
              }
            >
              Tier {option.risk_assessment.tier}
            </Badge>
          )}
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
      </div>

      <h3 className="mt-1 text-sm leading-snug font-semibold">{option.label}</h3>

      {recommended && <RecoveryGuidance option={option} />}

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
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
        Planning estimate
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{option.description}</p>

      {!recommended && <RecoveryGuidance option={option} />}

      <CostDetails breakdown={option.cost_breakdown} />

      <div className="mt-3 border-t border-border pt-2">
        <Row label="Extra time" value={days(option.days_added)} />
        <Row
          label="Extra fuel"
          value={`${option.fuel_pct.toFixed(1)}% · ${Math.round(option.fuel_tonnes)} t`}
        />
        <Row label="Risk" value={String(option.risk_score)} tone={riskTone(option.risk_score)} />
        <Row
          label="Estimated difference vs no action"
          value={usdExact(Math.max(0, decision.do_nothing.cost_usd - option.cost_usd))}
          tone="text-success"
        />
        <Row
          label="Status"
          value={refused ? "Blocked by safety rule" : committed ? "Applied" : "Allowed"}
          tone={refused ? "text-danger" : committed ? "text-success" : undefined}
        />
      </div>

      <RiskDetails option={option} />

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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-warning/35 bg-warning-surface/55 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Scenario estimates—not historical invoices or carrier quotes
            </p>
            <p className="mt-1 max-w-4xl text-[11px] leading-4 text-muted-foreground">
              These values model the fictional shipment shown above using route distance and
              configured benchmark inputs. Exact real-world costs require the carrier’s fuel
              purchase, charter, port, cargo, insurance, and contract records.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
          <a
            href="https://greenvoyage2050.imo.org/pdf/energy-efficiency-technologies-information-portal/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Speed/fuel method <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://unctad.org/system/files/official-document/rmt2023_en.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Cost benchmark <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DoNothingCard baseline={decision.do_nothing} />
        {ordered.map((o) => (
          <RecoveryOptionCard key={o.id} option={o} decision={decision} />
        ))}
      </div>
    </div>
  );
}
