import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, ClipboardCheck, LogOut, Radar, ScrollText, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSentinel } from "@/lib/sf/store";
import { Badge, Button } from "./ui";
import { ThemeToggle } from "./theme";

const NAV = [
  { to: "/planner", label: "Control tower", group: "Operations", icon: Radar },
  { to: "/approver", label: "Approvals", group: "Governance", icon: ClipboardCheck },
  { to: "/ledger", label: "Decision ledger", group: "Audit", icon: ScrollText },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { state, logout } = useSentinel();
  const pending = Object.values(state.runs).filter((r) => r.state === "PENDING_APPROVAL").length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Sentinel Flash</p>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Disruption control tower</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 px-2 py-4">
          {NAV.map((item) => (
            <div key={item.to}>
              <p className="label-xs px-2 pb-1">{item.group}</p>
              <Link
                to={item.to}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground font-medium" }}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </span>
                {item.to === "/approver" && pending > 0 && (
                  <span className="num rounded bg-warning-surface px-1.5 text-[11px] font-semibold text-warning">
                    {pending}
                  </span>
                )}
              </Link>
            </div>
          ))}
        </nav>

        <DemoControls />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {state.user && (
              <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
                <div className="text-right leading-tight">
                  <p className="text-xs font-medium">{state.user.name}</p>
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                    {state.user.role}
                  </p>
                </div>
                <Badge tone={state.user.role === "approver" ? "info" : "neutral"} dot={false}>
                  {state.user.role}
                </Badge>
              </div>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function DemoControls({ className }: { className?: string }) {
  const { triggerScenario, reset, isBusy, state } = useSentinel();
  const navigate = useNavigate();

  const scenarios = [
    { id: "SF-1001", label: "SF-1001 · autonomous" },
    { id: "SF-1002", label: "SF-1002 · refusal" },
    { id: "SF-1003", label: "SF-1003 · approval" },
  ];

  return (
    <div className={cn("border-t border-border px-3 py-3", className)}>
      <p className="label-xs pb-2">Demo controls</p>
      <div className="space-y-1.5">
        {scenarios.map((s) => {
          const run = state.runs[s.id];
          return (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              className="w-full justify-between"
              disabled={isBusy(s.id)}
              onClick={async () => {
                await triggerScenario(s.id);
                navigate({ to: "/shipment/$id", params: { id: s.id } });
              }}
            >
              <span className="num">{s.label}</span>
              {isBusy(s.id) ? (
                <span className="text-[10px] text-muted-foreground">running</span>
              ) : run ? (
                <span className="text-[10px] text-muted-foreground">done</span>
              ) : null}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            reset();
            navigate({ to: "/planner" });
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset demo
        </Button>
      </div>
      <p className="pt-2 text-[10px] leading-snug text-muted-foreground">
        Seeded operational data. Scenarios are reproducible and reset restores the seed state.
      </p>
    </div>
  );
}
