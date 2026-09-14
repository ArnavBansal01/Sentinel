import {
  Activity,
  AlertTriangle,
  Box,
  CircleDollarSign,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DECISION_STATE_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/sf/format";
import type { DecisionState, ShipmentStatus } from "@/lib/sf/types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-foreground border-border",
  info: "bg-info-surface text-info border-info/25",
  success: "bg-success-surface text-success border-success/25",
  warning: "bg-warning-surface text-warning border-warning/30",
  danger: "bg-danger-surface text-danger border-danger/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide uppercase",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const SHIPMENT_TONE: Record<ShipmentStatus, Tone> = {
  on_track: "success",
  monitoring: "neutral",
  disrupted: "danger",
  pending_approval: "warning",
  recovered: "success",
  escalated: "warning",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge tone={SHIPMENT_TONE[status]}>{SHIPMENT_STATUS_LABEL[status]}</Badge>;
}

const DECISION_TONE: Record<DecisionState, Tone> = {
  DECISION_READY: "info",
  AUTO_COMMITTED: "success",
  PENDING_APPROVAL: "warning",
  APPROVED_COMMITTED: "success",
  OVERRIDDEN_COMMITTED: "success",
  REJECTED_ESCALATED: "warning",
};

export function DecisionStateBadge({ state }: { state: DecisionState }) {
  return <Badge tone={DECISION_TONE[state]}>{DECISION_STATE_LABEL[state]}</Badge>;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex min-h-0 flex-col overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  const Icon = /shipment/i.test(label)
    ? Box
    : /disruption|problem/i.test(label)
      ? AlertTriangle
      : /approval|review/i.test(label)
        ? ClipboardCheck
        : /autonomous|decision/i.test(label)
          ? Sparkles
          : /value|risk/i.test(label)
            ? CircleDollarSign
            : Activity;
  const valueTone =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="metric-card panel flex min-h-28 flex-col justify-between gap-2 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="metric-label">{label}</span>
        <span className={cn("metric-icon", valueTone)}>
          <Icon size={17} strokeWidth={1.7} />
        </span>
      </div>
      <span
        className={cn("metric-value text-3xl leading-none font-semibold tracking-tight", valueTone)}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
        <ShieldCheck size={22} strokeWidth={1.5} />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function DemoTag({ children = "Demo data" }: { children?: ReactNode }) {
  return (
    <span className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

export function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "success" | "danger" | "warning";
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-surface text-foreground hover:bg-accent",
    ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
    success: "bg-success text-success-foreground hover:bg-success/90",
    danger: "bg-danger text-danger-foreground hover:bg-danger/90",
    warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  };
  return (
    <button
      className={cn(
        "button-glow inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
