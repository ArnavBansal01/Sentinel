import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentinel Flash — Supply-Chain Disruption Control Tower" },
      {
        name: "description",
        content:
          "Sentinel Flash detects supply-chain disruptions, evaluates recovery options, refuses unsafe optimisation and records every decision.",
      },
      { property: "og:title", content: "Sentinel Flash — Disruption Control Tower" },
      {
        property: "og:description",
        content: "Sense, decide and act on supply-chain disruption with auditable, constraint-safe automation.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { state, ready } = useSentinel();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    try {
      if (state.user) {
        navigate({ to: state.user.role === "approver" ? "/approver" : "/planner", replace: true });
      } else {
        navigate({ to: "/login", replace: true });
      }
    } catch (err) {
      console.error("Index navigation failed:", err);
      navigate({ to: "/login", replace: true });
    }
  }, [ready, state.user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Sentinel Flash — loading…</p>
    </div>
  );
}
