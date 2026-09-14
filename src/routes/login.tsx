import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ShieldCheck, ClipboardCheck, Radar } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/sf/theme";
import { Button } from "@/components/sf/ui";
import { DEMO_USERS } from "@/lib/sf/seed";
import { useSentinel } from "@/lib/sf/store";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/sf/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Sentinel Flash Control Tower" },
      {
        name: "description",
        content:
          "Operational sign-in for Sentinel Flash, the autonomous supply-chain disruption control tower.",
      },
      { property: "og:title", content: "Sign in — Sentinel Flash Control Tower" },
      {
        property: "og:description",
        content: "Planner and Approver access to the Sentinel Flash disruption control tower.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, state, ready } = useSentinel();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("planner");

  useEffect(() => {
    if (ready && state.user) {
      navigate({ to: state.user.role === "approver" ? "/approver" : "/planner", replace: true });
    }
  }, [ready, state.user, navigate]);

  return (
    <div className="login-page grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.12fr_0.88fr]">
      <section className="login-story relative hidden flex-col justify-between overflow-hidden px-12 py-10 lg:flex">
        <img
          src="/ocean-freight.png"
          alt="Container ship crossing calm ocean waters"
          className="login-ocean"
        />
        <div className="relative flex items-center gap-3">
          <img src="/sentinel-mark.svg" alt="" className="h-9 w-9" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-[15px] leading-4 font-semibold tracking-tight">Sentinel Flash</p>
            <p className="text-[9px] leading-3 font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Disruption control tower
            </p>
          </div>
        </div>

        <div className="login-story-copy relative max-w-lg">
          <p className="label-xs">INTELLIGENCE IN MOTION</p>
          <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-foreground">
            A world in motion.
            <br />
            <span>A step ahead.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sentinel Flash checks for shipping problems, compares recovery plans, blocks unsafe
            choices, and applies only the plans it is allowed to apply.
          </p>
          <dl className="login-capabilities mt-8 grid grid-cols-2 gap-5 border-t border-white/20 pt-6 text-sm">
            {[
              ["Automatic action", "Safe, low-risk plans can be applied automatically."],
              ["Safety blocks", "A plan that breaks temperature rules is always blocked."],
              ["Human review", "Important decisions wait for an Approver."],
              ["Decision history", "Every applied plan keeps its reason and system steps."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="flex items-center gap-2 font-medium">
                  <Check size={14} />
                  {t}
                </dt>
                <dd className="text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[11px] text-white/70">
          {state.systemStatus.mode === "LIVE"
            ? "Live provider mode. Every signal displays its provider and data status."
            : "Demo provider mode. Simulated evidence is explicitly labeled."}
        </p>
      </section>

      <section className="login-access flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[410px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="label-xs">YOUR OPERATIONS WORKSPACE</p>
              <h2 className="text-lg font-semibold tracking-tight">Welcome aboard.</h2>
            </div>
            <ThemeToggle />
          </div>

          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            One workspace for a more resilient supply chain. Choose your role to get started.
          </p>
          <fieldset className="space-y-3">
            <legend className="label-xs pb-1">Select role</legend>
            {DEMO_USERS.map((u) => {
              const active = role === u.role;
              const Icon = u.role === "planner" ? Radar : ClipboardCheck;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setRole(u.role)}
                  aria-pressed={active}
                  className={cn(
                    "role-card flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors",
                    active
                      ? "border-primary bg-accent"
                      : "border-border bg-surface hover:bg-accent/60",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium capitalize">{u.role}</span>
                    <span className="block text-xs text-muted-foreground">
                      {u.name} · {u.org}
                    </span>
                    <span className="num block text-[11px] text-muted-foreground">{u.email}</span>
                  </span>
                </button>
              );
            })}
          </fieldset>

          <Button
            className="mt-6 h-12 w-full"
            onClick={() => {
              login(role);
              navigate({ to: role === "approver" ? "/approver" : "/planner", replace: true });
            }}
          >
            Enter control tower <ArrowRight size={16} />
          </Button>

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={15} /> Role-based access · Auditable decisions
          </div>
          <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
            Demo accounts. Role permissions are enforced inside the application: a Planner cannot
            approve, reject or override a pending decision.
          </p>
        </div>
      </section>
    </div>
  );
}
