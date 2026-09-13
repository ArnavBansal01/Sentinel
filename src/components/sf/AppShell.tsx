import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ClipboardCheck,
  Database,
  GitBranch,
  LogOut,
  Maximize2,
  Minimize2,
  PackageSearch,
  Radar,
  Radio,
  ScrollText,
  RotateCcw,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSentinel } from "@/lib/sf/store";
import { Badge, Button } from "./ui";
import { ThemeToggle } from "./theme";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { dateTime } from "@/lib/sf/format";

const NAV = [
  { to: "/planner", label: "Live overview", group: "Operations", icon: Radar },
  { to: "/shipments", label: "Shipments", group: "Operations", icon: PackageSearch },
  { to: "/integrity", label: "Temperature safety", group: "Operations", icon: Snowflake },
  { to: "/scenarios", label: "Recovery plans", group: "Decisions", icon: GitBranch },
  { to: "/approver", label: "Review decisions", group: "Governance", icon: ClipboardCheck },
  { to: "/ledger", label: "Decision history", group: "Audit", icon: ScrollText },
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pending = Object.values(state.runs).filter((r) => r.state === "PENDING_APPROVAL").length;
  const notifications = state.activity.filter((event) =>
    /detected|refusal|approval|notification|completed|failed/i.test(event.type),
  ).slice(0, 30);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // CSS fallback below still exits the expanded view.
        }
      }
      setIsFullscreen(false);
      return;
    }

    const target = shellRef.current;
    if (target?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await target.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        // Embedded previews can block the native API; use the reliable CSS fallback.
      }
    }
    setIsFullscreen(true);
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "app-shell flex h-screen w-full overflow-hidden bg-background",
        isFullscreen && !document.fullscreenElement && "fixed inset-0 z-[100] h-[100dvh] w-screen",
      )}
    >
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <Link
          to="/planner"
          aria-label="Sentinel Flash live overview"
          className="brand-lockup flex h-16 items-center gap-3.5 border-b border-border bg-surface/95 px-4 backdrop-blur transition-colors hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset"
        >
          <img src="/sentinel-mark.svg" alt="" className="brand-mark h-9 w-9 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-[15px] leading-4 font-semibold tracking-tight">Sentinel Flash</p>
            <p className="truncate text-[9px] leading-3 font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Disruption control tower
            </p>
          </div>
        </Link>

        <nav className="flex-1 space-y-5 px-3 py-5">
          {NAV.map((item) => (
            <div key={item.to}>
              <p className="label-xs px-2 pb-1">{item.group}</p>
              <Link
                to={item.to}
                className="side-nav-link flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
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
        <header className="app-header flex h-16 shrink-0 items-center justify-between gap-5 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 [&_button]:rounded-full">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button type="button" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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

        <nav className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
          {NAV.map((item) => <Link key={item.to} to={item.to} className="whitespace-nowrap rounded px-2 py-1 text-[11px] text-muted-foreground" activeProps={{ className: "bg-accent text-foreground font-semibold" }}>{item.label}</Link>)}
        </nav>

        <main className="app-main min-h-0 flex-1 scroll-smooth overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function SystemStatusBar() {
  const { state } = useSentinel();
  const s = state.systemStatus;
  const live = s.mode === "LIVE";
  const healthy = s.backend === "healthy";
  const item = (label: string, value: string, Icon: typeof Radio) => (
    <span className="status-chip flex items-center gap-1.5 whitespace-nowrap rounded-full border border-current/20 bg-background/25 px-2.5 py-1.5 shadow-sm">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-semibold">{label}</span>
      <span className="opacity-75">{value}</span>
    </span>
  );
  return (
    <div
      className={cn(
        "status-ribbon flex min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b px-4 py-2 text-[10px] tracking-wide uppercase sm:px-6",
        live && healthy
          ? "border-success/25 bg-success-surface/70 text-success"
          : "border-warning/25 bg-warning-surface/70 text-warning",
      )}
    >
      <span className="status-chip flex items-center gap-2 whitespace-nowrap rounded-full border border-current/25 bg-background/30 px-3 py-1.5 text-[11px] font-bold shadow-sm">
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
      <span className="status-chip ml-auto hidden whitespace-nowrap rounded-full border border-current/15 bg-background/20 px-2.5 py-1.5 opacity-75 xl:inline">
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
    <div className={cn("border-t border-border px-4 py-4", className)}>
      <p className="label-xs pb-3">Presentation demos</p>
      <div className="space-y-2">
        {scenarios.map((s) => {
          const run = state.runs[s.id];
          return (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              className="w-full justify-between px-3"
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
      <p className="pt-3 text-[10px] leading-relaxed text-muted-foreground">
        These three buttons use fixed demo signals, so they work the same during every presentation. Other shipments use live checks.
      </p>
    </div>
  );
}
