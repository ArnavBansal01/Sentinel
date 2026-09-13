import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ClipboardCheck,
  Database,
  GitBranch,
  LogOut,
  Maximize2,
  PackageSearch,
  Play,
  Radar,
  Radio,
  ScrollText,
  RotateCcw,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSentinel } from "@/lib/sf/store";
import { Badge, Button } from "./ui";
import { ThemeToggle } from "./theme";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateTime } from "@/lib/sf/format";

const NAV = [
  { to: "/planner", label: "Live overview", group: "Operations", icon: Radar },
  { to: "/shipments", label: "Shipments", group: "Operations", icon: PackageSearch },
  { to: "/integrity", label: "Temperature safety", group: "Operations", icon: Snowflake },
  { to: "/scenarios", label: "Recovery plans", group: "Decisions", icon: GitBranch },
  { to: "/approver", label: "Review decisions", group: "Governance", icon: ClipboardCheck },
  { to: "/ledger", label: "Decision history", group: "Audit", icon: ScrollText },
] as const;

const WALKTHROUGH = [
  { to: "/planner", title: "Live overview", text: "Show the map, data-source status, and updates as they happen." },
  { to: "/shipments", title: "Shipment intelligence", text: "Search and filter the live shipment network." },
  { to: "/integrity", title: "Temperature safety", text: "Show the safety rules and why unsafe plans are blocked." },
  { to: "/scenarios", title: "AI recovery plans", text: "Run a demo and compare each plan with doing nothing." },
  { to: "/approver", title: "Human review", text: "Show how a person can approve, reject, or change a plan." },
  { to: "/ledger", title: "Proof of every decision", text: "Open the reason, source data, steps, then download JSON or CSV." },
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
  const navigate = useNavigate();
  const savedGuideStep = typeof window === "undefined" ? null : sessionStorage.getItem("sf.walkthrough.step");
  const [guideOpen, setGuideOpen] = useState(savedGuideStep !== null);
  const [guideStep, setGuideStep] = useState(() => Number(savedGuideStep ?? 0));
  const pending = Object.values(state.runs).filter((r) => r.state === "PENDING_APPROVAL").length;
  const notifications = state.activity.filter((event) =>
    /detected|refusal|approval|notification|completed|failed/i.test(event.type),
  ).slice(0, 30);
  const step = WALKTHROUGH[guideStep] ?? WALKTHROUGH[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Sentinel Flash</p>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
              Disruption control tower
            </p>
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
            <Button size="sm" variant="outline" className="hidden lg:inline-flex" onClick={() => { sessionStorage.setItem("sf.walkthrough.step", "0"); setGuideStep(0); setGuideOpen(true); navigate({ to: WALKTHROUGH[0].to }); }}>
              <Play className="h-3.5 w-3.5" /> Judge walkthrough
            </Button>
            <button type="button" aria-label="Toggle fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
              <Maximize2 className="h-4 w-4" />
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" aria-label="Open live notifications" className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-danger px-1 text-[9px] font-bold text-white">{Math.min(notifications.length, 99)}</span>}
                </button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto border-border bg-surface">
                <SheetHeader><SheetTitle>Live updates</SheetTitle><SheetDescription>New backend events appear here automatically.</SheetDescription></SheetHeader>
                <div className="mt-5 space-y-2">
                  {notifications.length === 0 ? <p className="text-sm text-muted-foreground">No operational notifications yet.</p> : notifications.map((event) => (
                    <Link key={event.id} to="/shipment/$id" params={{ id: event.shipmentId }} className="block rounded-lg border border-border bg-surface-muted p-3 hover:border-primary/50">
                      <div className="flex justify-between gap-3"><span className="num text-xs font-semibold">{event.shipmentId}</span><span className="text-[10px] text-muted-foreground">{dateTime(event.atIso)}</span></div>
                      <p className="mt-1 text-xs">{event.message}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{event.stage} · {event.type}</p>
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
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

        <SystemStatusBar />

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5 md:hidden">
          {NAV.map((item) => <Link key={item.to} to={item.to} className="whitespace-nowrap rounded px-2 py-1 text-[11px] text-muted-foreground" activeProps={{ className: "bg-accent text-foreground font-semibold" }}>{item.label}</Link>)}
        </nav>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
      <Dialog open={guideOpen} onOpenChange={(open) => { setGuideOpen(open); if (!open) sessionStorage.removeItem("sf.walkthrough.step"); }}>
        <DialogContent className="border-primary/30 bg-surface">
          <DialogHeader><DialogTitle>{guideStep + 1} / {WALKTHROUGH.length} · {step.title}</DialogTitle><DialogDescription>{step.text}</DialogDescription></DialogHeader>
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-muted-foreground">Presentation tip: show the <strong className="text-foreground">{state.systemStatus.mode}</strong> bar and the data labels. They make it clear what is live, demo, or unavailable.</div>
          <div className="flex justify-between gap-2"><Button variant="outline" disabled={guideStep === 0} onClick={() => { const next = Math.max(0, guideStep - 1); sessionStorage.setItem("sf.walkthrough.step", String(next)); setGuideStep(next); navigate({ to: (WALKTHROUGH[next] ?? WALKTHROUGH[0]).to }); }}>Previous</Button><Button onClick={() => { if (guideStep === WALKTHROUGH.length - 1) { sessionStorage.removeItem("sf.walkthrough.step"); setGuideOpen(false); return; } const next = Math.min(WALKTHROUGH.length - 1, guideStep + 1); sessionStorage.setItem("sf.walkthrough.step", String(next)); setGuideStep(next); navigate({ to: (WALKTHROUGH[next] ?? WALKTHROUGH[0]).to }); }}>{guideStep === WALKTHROUGH.length - 1 ? "Finish" : "Next scene"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SystemStatusBar() {
  const { state } = useSentinel();
  const s = state.systemStatus;
  const live = s.mode === "LIVE";
  const healthy = s.backend === "healthy";
  const item = (label: string, value: string, Icon: typeof Radio) => (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-semibold">{label}</span>
      <span className="opacity-75">{value}</span>
    </span>
  );
  return (
    <div
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-4 overflow-x-auto border-b px-4 text-[10px] tracking-wide uppercase",
        live && healthy
          ? "border-success/30 bg-success-surface text-success"
          : "border-warning/30 bg-warning-surface text-warning",
      )}
    >
      <span className="flex items-center gap-2 text-xs font-bold">
        <span className={cn("relative flex h-2.5 w-2.5", healthy && "status-ping")}>
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        {healthy ? `${s.mode} SYSTEM` : "BACKEND OFFLINE"}
      </span>
      {item("Gemini", s.gemini, Sparkles)}
      {item("News", s.news, Radio)}
      {item("Weather", s.weather, Radio)}
      {item("AIS", s.ais, Radio)}
      {item("Database", s.database, Database)}
      <span className="ml-auto hidden whitespace-nowrap opacity-70 lg:inline">
        Every data source is clearly labeled
      </span>
    </div>
  );
}

export function DemoControls({ className }: { className?: string }) {
  const { triggerScenario, reset, isBusy, state } = useSentinel();
  const navigate = useNavigate();

  const scenarios = [
    { id: "SF-1001", label: "Auto decision demo" },
    { id: "SF-1002", label: "Safety block demo" },
    { id: "SF-1003", label: "Human review demo" },
  ];

  return (
    <div className={cn("border-t border-border px-3 py-3", className)}>
      <p className="label-xs pb-2">Presentation demos</p>
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
                await triggerScenario(s.id, true);
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
          Clear current view
        </Button>
      </div>
      <p className="pt-2 text-[10px] leading-snug text-muted-foreground">
        These three buttons use fixed demo signals, so they work the same during every presentation. Other shipments use live checks.
      </p>
    </div>
  );
}
