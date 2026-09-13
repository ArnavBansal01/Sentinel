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
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
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
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
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
  const valueTone =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="flex flex-col justify-between gap-1 border-r border-border px-4 py-3 last:border-r-0">
      <span className="label-xs">{label}</span>
      <span className={cn("num text-xl leading-none font-semibold", valueTone)}>{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center">
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
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
