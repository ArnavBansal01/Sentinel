import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, ClipboardCheck, Radar } from "lucide-react";
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
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-surface px-12 py-10 lg:flex">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Sentinel Flash</span>
        </div>

        <div className="max-w-md">
          <p className="label-xs">Supply-chain problem solver</p>
          <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-foreground">
            Sense. Decide. Act.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sentinel Flash checks for shipping problems, compares recovery plans, blocks unsafe choices,
            and applies only the plans it is allowed to apply.
          </p>
          <dl className="mt-8 space-y-3 border-t border-border pt-6 text-sm">
            {[
              ["Automatic action", "Safe, low-risk plans can be applied automatically."],
              ["Safety blocks", "A plan that breaks temperature rules is always blocked."],
              ["Human review", "Important decisions wait for an Approver."],
              ["Decision history", "Every applied plan keeps its reason and system steps."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-medium text-foreground">{t}</dt>
                <dd className="text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {state.systemStatus.mode === "LIVE"
            ? "Live provider mode. Every signal displays its provider and data status."
            : "Demo provider mode. Simulated evidence is explicitly labeled."}
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="label-xs">Operations access</p>
              <h2 className="text-lg font-semibold tracking-tight">Sign in to the control tower</h2>
            </div>
            <ThemeToggle />
          </div>

          <fieldset className="space-y-2">
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
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    active ? "border-primary bg-accent" : "border-border bg-surface hover:bg-accent/60",
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
            className="mt-5 w-full"
            onClick={() => {
              login(role);
              navigate({ to: role === "approver" ? "/approver" : "/planner", replace: true });
            }}
          >
            Enter control tower
          </Button>

          <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
            Demo accounts. Role permissions are enforced inside the application: a Planner cannot approve,
            reject or override a pending decision.
          </p>
        </div>
      </section>
    </div>
  );
}
