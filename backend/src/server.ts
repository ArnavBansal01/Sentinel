import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { repository } from "./persistence/database.js";
import { eventBus } from "./events/eventBus.js";
import { SenseAgent } from "./agents/sense/senseAgent.js";
import { DecideAgent } from "./agents/decide/decideAgent.js";
import { ActAgent } from "./agents/act/actAgent.js";
import { orchestrate, approve } from "./orchestrator.js";
import { aisRuntimeStatus } from "./connectors/ais/aisStreamConnector.js";
import type { ActivityEvent, Decision, DecisionOption } from "./types/domain.js";
export const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_q, r) => {
  let database = "healthy";
  try {
    repository.health();
  } catch {
    database = "unavailable";
  }
  r.json({
    backend: "healthy",
    mode: config.mode,
    gemini: process.env["GEMINI_API_KEY"] ? "configured" : "unavailable",
    news: config.mode === "LIVE" ? "healthy" : "demo",
    weather: config.mode === "LIVE" ? "healthy" : "demo",
    ais: aisRuntimeStatus.status,
    port:
      process.env["PORTCAST_API_KEY"] && process.env["PORTCAST_ORG_ID"]
        ? "configured"
        : "unavailable",
    database,
    costModel: {
      method: "route_cost_v1",
      bunkerFuelUsdPerTonne: config.economics.bunkerFuelUsdPerTonne,
      vesselOperatingUsdPerDay: config.economics.vesselOperatingUsdPerDay,
      baseFuelTonnesPerDay: config.economics.baseFuelTonnesPerDay,
      baseSpeedKnots: config.routing.vesselSpeedKnots,
      respeedKnots: config.economics.respeedKnots,
    },
  });
});
app.get("/api/shipments", (_q, r) => r.json(repository.shipments()));
app.get("/api/shipments/:id", (q, r) => {
  const x = repository.shipment(q.params.id);
  if (x) r.json(x);
  else r.status(404).json({ error: "shipment_not_found" });
});
app.get("/api/workflows", (_q, r) => {
  const seen = new Set<string>();
  const workflows = repository.workflowResults().flatMap((stored) => {
    const shipmentId = String((stored["shipment"] as { id?: string } | undefined)?.id ?? "");
    if (!shipmentId || seen.has(shipmentId)) return [];
    seen.add(shipmentId);
    const shipment = repository.shipment(shipmentId);
    if (!shipment) return [];
    const decision = stored["decision"] as Decision | null;
    const storedAction = decision ? repository.actionByDecision(decision.id) : undefined;
    const action = storedAction ? JSON.parse(storedAction.json) : stored["action"];
    return [
      {
        ...stored,
        shipment,
        decision: action?.decision ?? decision,
        action,
        persistedState: shipment.currentState,
      },
    ];
  });
  r.json(workflows);
});
app.post("/api/sense/:shipmentId", async (q, r, n) => {
  try {
    const s = repository.shipment(q.params.shipmentId);
    if (!s) return r.status(404).json({ error: "shipment_not_found" });
    const traceId = String(q.body?.traceId ?? randomUUID());
    const d = await new SenseAgent().run(s, traceId);
    repository.saveDisruption(d);
    r.json({ traceId, disruption: d });
  } catch (e) {
    n(e);
  }
});
app.post("/api/decide/:shipmentId", async (q, r, n) => {
  try {
    const s = repository.shipment(q.params.shipmentId),
      d = repository.disruption(q.params.shipmentId);
    if (!s || !d) return r.status(409).json({ error: "sense_required" });
    const traceId = String(q.body?.traceId ?? randomUUID()),
      requestId = String(q.body?.requestId ?? randomUUID());
    const decision = await new DecideAgent().run(s, d, traceId, requestId);
    repository.saveDecision(decision);
    r.json({ traceId, decision });
  } catch (e) {
    n(e);
  }
});
app.post("/api/act/:shipmentId", async (q, r, n) => {
  try {
    const s = repository.shipment(q.params.shipmentId),
      d = repository.decision(q.params.shipmentId);
    if (!s || !d) return r.status(409).json({ error: "decision_required" });
    if (d.overallStatus === "PENDING_APPROVAL")
      return r.status(409).json({ error: "approval_required" });
    r.json(await new ActAgent().run(s, d, String(q.body?.traceId ?? randomUUID())));
  } catch (e) {
    n(e);
  }
});
app.post("/api/orchestrate/:shipmentId", async (q, r, n) => {
  try {
    r.json(
      await orchestrate(
        q.params.shipmentId,
        String(q.body?.requestId ?? q.header("idempotency-key") ?? randomUUID()) as ReturnType<
          typeof randomUUID
        >,
      ),
    );
  } catch (e) {
    n(e);
  }
});
app.post("/api/demo/orchestrate/:shipmentId", async (q, r, n) => {
  try {
    r.json(
      await orchestrate(
        q.params.shipmentId,
        String(q.body?.requestId ?? q.header("idempotency-key") ?? randomUUID()) as ReturnType<
          typeof randomUUID
        >,
        true,
      ),
    );
  } catch (e) {
    n(e);
  }
});
app.post("/api/prototype/orchestrate/:shipmentId", async (q, r, n) => {
  try {
    r.json(
      await orchestrate(
        q.params.shipmentId,
        String(q.body?.requestId ?? q.header("idempotency-key") ?? randomUUID()) as ReturnType<
          typeof randomUUID
        >,
        false,
        true,
      ),
    );
  } catch (e) {
    n(e);
  }
});
for (const kind of ["approval", "reject", "override"] as const)
  app.post(`/api/${kind}/:shipmentId`, async (q, r, n) => {
    try {
      r.json(
        await approve(
          q.params.shipmentId,
          kind === "approval" ? "approve" : kind,
          String(q.header("x-user-role") ?? "planner"),
          q.body?.optionId,
        ),
      );
    } catch (e) {
      n(e);
    }
  });
app.get("/api/activity", (_q, r) => r.json(repository.activity()));
app.get("/api/ais/status", (_q, r) =>
  r.json({
    provider: "AISStream",
    mode: config.mode,
    configured: Boolean(process.env["AISSTREAM_API_KEY"]),
    ...aisRuntimeStatus,
  }),
);
app.get("/api/ledger", (_q, r) => r.json(repository.ledger()));
app.get("/api/ledger/export", (q, r) => {
  const entries = repository.ledger();
  const format = String(q.query["format"] ?? "json").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const cell = (value: unknown) => {
      const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = entries.map((entry) => {
      const payload = entry.payload as {
        decision?: Decision;
        selectedOption?: DecisionOption;
        logs?: ActivityEvent[];
      };
      const decision = payload.decision;
      const selected = payload.selectedOption;
      return [
        entry.timestamp,
        entry.id,
        entry.traceId,
        entry.shipmentId,
        entry.actor,
        selected?.type,
        selected?.costUsd,
        selected?.delayDays,
        selected?.fuelTonnes,
        selected?.riskScore,
        selected?.costBreakdown?.bunkerFuelUsdPerTonne,
        selected?.costBreakdown?.fuelUsd,
        selected?.costBreakdown?.vesselTimeUsd,
        selected?.costBreakdown?.handlingUsd,
        selected?.costBreakdown?.cargoProtectionUsd,
        selected?.costBreakdown?.riskReserveUsd,
        decision?.provider,
        decision?.reasoning,
        decision?.policyRulesTriggered,
        payload.logs,
      ]
        .map(cell)
        .join(",");
    });
    r.set({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sentinel-ledger-${stamp}.csv"`,
    });
    return r.send(
      [
        "timestamp",
        "ledger_id",
        "trace_id",
        "shipment_id",
        "actor",
        "selected_option",
        "cost_usd",
        "delay_days",
        "fuel_tonnes",
        "risk_score",
        "bunker_fuel_usd_per_tonne",
        "fuel_cost_usd",
        "vessel_time_cost_usd",
        "handling_cost_usd",
        "cargo_protection_cost_usd",
        "risk_reserve_usd",
        "decision_provider",
        "ai_reasoning",
        "policy_rules",
        "trace_logs",
      ]
        .map(cell)
        .join(",") +
        "\n" +
        rows.join("\n"),
    );
  }
  r.set({
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="sentinel-ledger-${stamp}.json"`,
  });
  return r.send(
    JSON.stringify(
      { exportedAt: new Date().toISOString(), schemaVersion: "1.0", appendOnly: true, entries },
      null,
      2,
    ),
  );
});
app.get("/api/ledger/:id", (q, r) => {
  const x = repository.ledgerOne(q.params.id);
  if (x) r.json(x);
  else r.status(404).json({ error: "ledger_not_found" });
});
app.get("/api/events/stream", (q, r) => {
  r.set({
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  r.flushHeaders();
  r.write(
    `event: connected\ndata: ${JSON.stringify({ mode: config.mode, timestamp: new Date().toISOString() })}\n\n`,
  );
  const send = (e: unknown) => r.write(`event: activity\ndata: ${JSON.stringify(e)}\n\n`);
  eventBus.on("event", send);
  const keep = setInterval(() => r.write(": heartbeat\n\n"), 15000);
  q.on("close", () => {
    clearInterval(keep);
    eventBus.off("event", send);
  });
});
app.use(
  (
    e: Error & { status?: number; code?: string },
    _q: express.Request,
    r: express.Response,
    _n: express.NextFunction,
  ) => {
    console.error(e);
    r.status(e.status ?? (e.code === "GEMINI_PROVIDER_FAILED" ? 503 : 500)).json({
      error: e.code ?? "backend_error",
      message: e.message,
      decisionProvider: e.code === "GEMINI_PROVIDER_FAILED" ? "gemini" : undefined,
      status: e.code === "GEMINI_PROVIDER_FAILED" ? "provider_failed" : undefined,
    });
  },
);
if (process.env["NODE_ENV"] !== "test")
  app.listen(config.port, () =>
    console.info(`[SYSTEM] Sentinel backend on http://localhost:${config.port} (${config.mode})`),
  );
