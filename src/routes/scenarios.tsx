import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, GitBranch, Play } from "lucide-react";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, Button, EmptyState, Panel } from "@/components/sf/ui";
import { usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";

export const Route = createFileRoute("/scenarios")({
  component: () => (
    <RequireSession>
      <ScenariosPage />
    </RequireSession>
  ),
});

function ScenariosPage() {
  const { state, triggerScenario, isBusy } = useSentinel();
  const runs = Object.values(state.runs);

  return (
    <AppShell title="Recovery plans" subtitle="Sense → Simulate → Decide → Commit">
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        <Panel
          title="Create a recovery plan"
          subtitle="Prototype scenarios inject repeatable disruptions; SF-2043 is the no-disruption control"
        >
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {state.shipments.map((shipment) => {
              const isControl = shipment.id === "SF-2043";
              return (
                <div
                  key={shipment.id}
                  className="rounded-lg border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-xs font-semibold">{shipment.id}</span>
                    <Badge tone={isControl ? "neutral" : "info"}>
                      {isControl ? "control route" : "prototype disruption"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs">
                    {shipment.origin.name} → {shipment.destination.name}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    disabled={isBusy(shipment.id) || state.systemStatus.backend !== "healthy"}
                    onClick={() => triggerScenario(shipment.id, false, true)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {isBusy(shipment.id) ? "Checking…" : "Run prototype check"}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Plans already created"
          subtitle="Each result keeps its data sources, runtime provider, and safety checks"
        >
          {runs.length === 0 ? (
            <EmptyState
              title="No analysis run yet"
              description="Run a shipment above to generate a prototype recovery plan."
            />
          ) : (
            <div className="grid gap-3 p-3 lg:grid-cols-2">
              {runs.map((run) => {
                const recommended = run.decision?.options.find(
                  (option) => option.id === run.decision?.recommended_option_id,
                );
                return (
                  <Link
                    key={run.shipmentId}
                    to="/shipment/$id"
                    params={{ id: run.shipmentId }}
                    className="rounded-lg border border-border bg-surface-muted p-4 hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        <span className="num font-semibold">{run.shipmentId}</span>
                      </span>
                      <Badge
                        tone={
                          run.state === "ERROR"
                            ? "danger"
                            : run.state === "PENDING_APPROVAL"
                              ? "warning"
                              : "success"
                        }
                      >
                        {run.state.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {run.error ? (
                      <p className="mt-3 text-xs text-danger">{run.error}</p>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-medium">
                          {recommended?.label ??
                            (run.state === "SENSE_COMPLETE"
                              ? "No verified disruption"
                              : "No viable option")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recommended
                            ? `${usdExact(recommended.cost_usd)} · ${recommended.days_added} days · risk ${recommended.risk_score}`
                            : run.state === "SENSE_COMPLETE"
                              ? "Decision and action stages were safely skipped."
                              : "Policy refused commitment"}
                        </p>
                        <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                          <span>
                            <GitBranch className="mr-1 inline h-3 w-3" />
                            {run.decision?.options.length ?? 0} options
                          </span>
                          <span>{run.decision?.refusals.length ?? 0} refused</span>
                          <span>
                            {run.decision
                              ? run.decision.sourceNote === "demo"
                                ? "Prototype logic"
                                : run.decision.source === "gemini"
                                  ? "Gemini runtime"
                                  : "Backup logic"
                              : "Sense only"}
                          </span>
                        </div>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
