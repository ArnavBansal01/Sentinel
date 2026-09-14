/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { normalizeGdeltArticle } from "../src/connectors/news/gdeltConnector.js";
import { normalizeOpenMeteo } from "../src/connectors/weather/openMeteoConnector.js";
import { normalizeAisMessage } from "../src/connectors/ais/aisStreamConnector.js";
import { calculateConfidence } from "../src/agents/sense/confidence.js";
import { SenseAgent } from "../src/agents/sense/senseAgent.js";
import { GeminiDecisionSchema } from "../src/agents/decide/decisionSchema.js";
import { applyPolicy, computeRiskTier } from "../src/policy/policyEngine.js";
import { shipments } from "../src/shipments/seed.js";
import { orchestrate, approve, commitExpiredReviews } from "../src/orchestrator.js";
import { app } from "../src/server.js";
import { repository } from "../src/persistence/database.js";
import { eventBus } from "../src/events/eventBus.js";
import { estimateRecoveryOption } from "../src/economics/costEstimator.js";
import { routeFor } from "../src/routing/routeEngine.js";
import { selectApplicableRecoveryTypes } from "../src/recovery/recoveryOptions.js";
import type { Decision, Signal } from "../src/types/domain.js";
import { normalizeShipmentDraft } from "../src/shipments/editor.js";
const sf = (id: string) => structuredClone(shipments.find((s) => s.id === id)!);
const raw = {
  options: ["reroute", "respeed", "switch_mode"].map((type) => ({
    type,
    status: "viable",
    costUsd: 1,
    delayDays: 1,
    fuelTonnes: 1,
    riskScore: 1,
    reason: "valid reason",
  })),
  doNothing: { costUsd: 1, delayDays: 1, fuelTonnes: 0, riskScore: 1, reason: "baseline reason" },
  recommendedOption: "reroute",
  reasoning: "Sufficient structured reasoning.",
};
describe("provider normalization", () => {
  it("normalizes GDELT", () =>
    expect(
      normalizeGdeltArticle(
        { url: "https://x", domain: "x", title: "Port disruption", seendate: "20260913T120000Z" },
        "Rotterdam",
      ),
    ).toMatchObject({ provider: "GDELT", dataStatus: "LIVE", type: "NEWS" }));
  it("normalizes Open-Meteo", () =>
    expect(
      normalizeOpenMeteo(
        {
          current: {
            time: "2026-09-13T12:00",
            wind_speed_10m: 50,
            wind_gusts_10m: 80,
            precipitation: 22,
          },
        },
        { name: "Ningbo", code: "CNNGB", lat: 1, lon: 2 },
      ).confidence,
    ).toBe(0.9));
  it("normalizes AIS", () =>
    expect(
      normalizeAisMessage({
        MetaData: { MMSI: 123, ShipName: "Test" },
        Message: { PositionReport: { Latitude: 1, Longitude: 2, Sog: 3 } },
      }),
    ).toMatchObject({ mmsi: "123", shipName: "Test", latitude: 1 }));
});
describe("confidence and schema", () => {
  it("does not trigger on one weak source", () => {
    const x: Signal = {
      id: "1",
      source: "x",
      type: "NEWS",
      timestamp: new Date().toISOString(),
      location: "x",
      confidence: 0.51,
      title: "x",
      description: "x",
      provider: "one",
      dataStatus: "LIVE",
    };
    expect(calculateConfidence([x]).exists).toBe(false);
  });
  it("corroborates independent operational evidence", () => {
    const base = {
      timestamp: new Date().toISOString(),
      location: "x",
      confidence: 0.9,
      title: "x",
      description: "x",
      dataStatus: "LIVE" as const,
    };
    expect(
      calculateConfidence([
        { ...base, id: "1", source: "a", type: "NEWS", provider: "news" },
        { ...base, id: "2", source: "b", type: "PORT", provider: "port" },
      ]).exists,
    ).toBe(true);
  });
  it("accepts exact structured response", () =>
    expect(GeminiDecisionSchema.safeParse(raw).success).toBe(true));
  it("rejects numeric strings", () =>
    expect(
      GeminiDecisionSchema.safeParse({
        ...raw,
        options: [{ ...raw.options[0], costUsd: "1" }, ...raw.options.slice(1)],
      }).success,
    ).toBe(false));
  it("rejects duplicate option types", () =>
    expect(
      GeminiDecisionSchema.safeParse({
        ...raw,
        options: raw.options.map((o) => ({ ...o, type: "reroute" })),
      }).success,
    ).toBe(false));
});
describe("policy", () => {
  const decision = (): Decision => ({
    id: "d",
    requestId: "r",
    shipmentId: "s",
    disruptionId: "x",
    overallStatus: "",
    options: (raw.options as any[]).map((o, i) => ({ ...o, id: String(i), policyReasons: [] })),
    doNothing: raw.doNothing,
    recommendedOption: "1",
    reasoning: raw.reasoning,
    provider: "deterministic_demo",
    providerStatus: "demo",
    policyRulesTriggered: [],
    createdAt: new Date().toISOString(),
  });
  it("refuses cold-chain re-speed", () => {
    const d = applyPolicy(sf("SF-1002"), decision());
    expect(d.options.find((o) => o.type === "respeed")?.status).toBe("refused");
  });
  it("requires approval above $1M", () =>
    expect(applyPolicy(sf("SF-1003"), decision()).overallStatus).toBe("PENDING_APPROVAL"));
  it("requires approval above 7 days", () => {
    const d = decision();
    d.recommendedOption = "0";
    d.options[0]!.delayDays = 8;
    expect(applyPolicy(sf("SF-1001"), d).overallStatus).toBe("PENDING_APPROVAL");
  });
  it("requires approval above 1000t fuel", () => {
    const d = decision();
    d.recommendedOption = "0";
    d.options[0]!.fuelTonnes = 1001;
    expect(applyPolicy(sf("SF-1001"), d).overallStatus).toBe("PENDING_APPROVAL");
  });
  it("explains all risk factors and raises a low-confidence autonomy gate", () => {
    const option: any = {
      ...raw.options[0],
      id: "risk-option",
      costUsd: 5_000,
      delayDays: 0.5,
      feasibility: "confirmed",
      policyReasons: [],
    };
    const risk = computeRiskTier(sf("SF-2045"), { confidence: 0.4 }, option);
    expect(risk.tier).toBeGreaterThanOrEqual(3);
    expect(risk.criteria).toHaveLength(9);
    expect(risk.hardOverrides.join(" ")).toContain("confidence");
  });
  it("floors sanction or contested-corridor decisions at Tier 4", () => {
    const shipment = sf("SF-2041");
    shipment.constraints.push("War-risk approval may be denied in contested corridor");
    const d = decision();
    d.recommendedOption = "0";
    d.options.forEach((option) => (option.feasibility = "confirmed"));
    expect(applyPolicy(shipment, d).overallStatus).toBe("ESCALATED");
  });
});
describe("recovery applicability", () => {
  it("selects port-specific levers for a port disruption", () => {
    const types = selectApplicableRecoveryTypes(sf("SF-2041"), {
      type: "PORT_CONGESTION",
      location: "Hamburg port",
      explanation: "Berth congestion and customs delay",
      severity: 55,
    } as any);
    expect(types).toContain("port_switch");
    expect(types).toContain("hold_and_wait");
    expect(types).toHaveLength(3);
  });
});
describe("route-specific economics", () => {
  it("produces different costs for different routes and reconciles the breakdown", () => {
    const ningbo = sf("SF-1001");
    const jebelAli = sf("SF-2043");
    const longRoute = estimateRecoveryOption(ningbo, "reroute", routeFor(ningbo, "reroute"));
    const shortRoute = estimateRecoveryOption(jebelAli, "reroute", routeFor(jebelAli, "reroute"));
    expect(longRoute.costUsd).not.toBe(shortRoute.costUsd);
    expect(longRoute.fuelTonnes).toBeGreaterThan(shortRoute.fuelTonnes);
    const b = longRoute.costBreakdown!;
    expect(longRoute.costUsd).toBe(
      b.fuelUsd + b.vesselTimeUsd + b.handlingUsd + b.cargoProtectionUsd + b.riskReserveUsd,
    );
  });
});
describe("shipment editor", () => {
  const draft = {
    id: "SF-EDITOR-TEST",
    originCode: "BEANR",
    destinationCode: "KEMBA",
    cargo: "Insulin pens",
    cargoCategory: "medicine" as const,
    quantity: 18,
    quantityUnit: "pallets" as const,
    cargoValueUsd: 620000,
    mode: "ocean" as const,
    vessel: "MV Horizon",
    etaIso: "2026-10-24T06:00:00.000Z",
    temperatureMinC: 2,
    temperatureMaxC: 8,
    priority: "critical" as const,
    reference: "BK-482",
    owner: "Health Network",
    notes: "Handle under GDP",
    constraints: ["GDP-certified handling"],
  };

  it("normalizes editor details into an operational cold-chain shipment", () => {
    const shipment = normalizeShipmentDraft(draft, "Test editor");
    expect(shipment).toMatchObject({
      id: "SF-EDITOR-TEST",
      coldChain: true,
      temperatureMinC: 2,
      temperatureMaxC: 8,
      quantity: 18,
      currentState: "MONITORED",
      createdBy: "Test editor",
    });
    expect(shipment.constraints[0]).toContain("2–8 °C");
  });

  it("creates and removes shipments only with the editor role", async () => {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not bind");
      const base = `http://127.0.0.1:${address.port}`;
      const denied = await fetch(`${base}/api/shipments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": "planner" },
        body: JSON.stringify(draft),
      });
      expect(denied.status).toBe(403);

      const created = await fetch(`${base}/api/shipments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-role": "editor",
          "x-user-name": "Test editor",
        },
        body: JSON.stringify(draft),
      });
      expect(created.status).toBe(201);
      expect(repository.shipment(draft.id)?.cargo).toBe("Insulin pens");

      const removed = await fetch(`${base}/api/shipments/${draft.id}`, {
        method: "DELETE",
        headers: { "x-user-role": "editor", "x-user-name": "Test editor" },
      });
      expect(removed.status).toBe(200);
      expect(repository.shipment(draft.id)).toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
describe("integration", () => {
  beforeAll(() => {
    process.env["SENTINEL_MODE"] = "demo";
    process.env["SYSTEM_REVIEW_WINDOW_MS"] = "0";
  });
  it("SF-1001 runs Sense-Decide-Policy-Act and is idempotent", async () => {
    const id = randomUUID(),
      a: any = await orchestrate("SF-1001", id),
      b: any = await orchestrate("SF-1001", id);
    expect(a.action.actionId).toBe(b.action.actionId);
    expect(repository.ledger().filter((x) => x.actionId === a.action.actionId)).toHaveLength(1);
  });
  it("SF-1002 omits inapplicable re-speed and awaits cold-chain approval", async () => {
    const x: any = await orchestrate("SF-1002", randomUUID());
    expect(x.decision.options.some((o: any) => o.type === "respeed")).toBe(false);
    expect(x.decision.options).toHaveLength(3);
    expect(x.decision.overallStatus).toBe("PENDING_APPROVAL");
  });
  it("SF-1003 requires approval and planner is blocked", async () => {
    const x: any = await orchestrate("SF-1003", randomUUID());
    expect(x.decision.overallStatus).toBe("PENDING_APPROVAL");
    await expect(approve("SF-1003", "approve", "planner")).rejects.toMatchObject({ status: 403 });
  });
  it("SSE event order follows agent pipeline", async () => {
    const events: string[] = [];
    const fn = (e: any) => events.push(e.eventType);
    eventBus.on("event", fn);
    await orchestrate("SF-1001", randomUUID());
    eventBus.off("event", fn);
    expect(events.indexOf("sense.started")).toBeLessThan(events.indexOf("decide.started"));
    expect(events.indexOf("policy.completed")).toBeLessThan(events.indexOf("act.started"));
  });

  it("loads every shipment and completes every demo workflow without missing-route errors", async () => {
    expect(shipments).toHaveLength(8);
    for (const shipment of shipments) {
      expect(repository.shipment(shipment.id)?.id).toBe(shipment.id);
      const result: any = await orchestrate(shipment.id, randomUUID(), true);
      expect(result.shipment.id).toBe(shipment.id);
      expect(result.disruption.evidence.length).toBeGreaterThan(0);
      expect(result.decision).not.toBeNull();
      expect(["AUTO_COMMIT", "AUTO_COMMIT_NOTIFY", "PENDING_APPROVAL", "ESCALATED"]).toContain(
        result.decision.overallStatus,
      );
    }
  });

  it("clears saved presentation demos and restores their shipment state", async () => {
    await orchestrate("SF-1001", randomUUID(), true);
    const cleared = repository.clearDemoData();
    expect(cleared).toEqual(["SF-1001", "SF-1002", "SF-1003"]);
    expect(repository.shipment("SF-1001")?.currentState).toBe("MONITORED");
    expect(repository.shipment("SF-1001")?.status).toBe("monitoring");
    expect(
      repository
        .workflowResults()
        .some((result) =>
          cleared.includes(String((result["shipment"] as { id?: string } | undefined)?.id)),
        ),
    ).toBe(false);
    expect(repository.ledger().some((entry) => cleared.includes(entry.shipmentId))).toBe(false);
  });

  it("stores a demo disruption and consumes it during the normal check workflow", async () => {
    const shipment = repository.shipment("SF-2041")!;
    const disruption = await SenseAgent.demo().run(shipment, randomUUID());
    repository.saveDemoInjection(shipment.id, randomUUID(), disruption);

    const result: any = await orchestrate(shipment.id, randomUUID());
    expect(result.disruption.eventId).toBe(disruption.eventId);
    expect(result.disruption.evidence.every((signal: any) => signal.dataStatus === "DEMO")).toBe(
      true,
    );
    expect(result.decision.provider).toBe("deterministic_demo");
    expect(repository.demoInjection(shipment.id)).toBeUndefined();
  });

  it("holds eligible system decisions for review and commits them after the deadline", async () => {
    process.env["SYSTEM_REVIEW_WINDOW_MS"] = "7200000";
    try {
      const result: any = await orchestrate("SF-2042", randomUUID(), true);
      expect(result.action).toBeNull();
      expect(result.decision.overallStatus).toBe("PENDING_APPROVAL");
      expect(result.decision.autoCommitAfterReview).toBe(true);
      expect(Date.parse(result.decision.reviewDeadlineIso)).toBeGreaterThan(Date.now());

      result.decision.reviewDeadlineIso = new Date(Date.now() - 1_000).toISOString();
      repository.updateDecision(result.decision);
      const committed = await commitExpiredReviews();
      expect(committed).toContain("SF-2042");
      expect(repository.shipment("SF-2042")?.currentState).toBe("COMMITTED");
      expect(repository.actionByDecision(result.decision.id)).toBeTruthy();
    } finally {
      process.env["SYSTEM_REVIEW_WINDOW_MS"] = "0";
    }
  });

  it("supports approver approve, reject and viable override outcomes", async () => {
    const approvalRun: any = await orchestrate("SF-1002", randomUUID(), true);
    expect(approvalRun.decision.overallStatus).toBe("PENDING_APPROVAL");
    const approved: any = await approve("SF-1002", "approve", "approver");
    expect(approved.actionId).toBeTruthy();
    expect(repository.shipment("SF-1002")?.currentState).toBe("COMMITTED");

    const rejectRun: any = await orchestrate("SF-1003", randomUUID(), true);
    expect(rejectRun.decision.overallStatus).toBe("PENDING_APPROVAL");
    const rejected: any = await approve("SF-1003", "reject", "approver");
    expect(rejected.status).toBe("REJECTED");
    expect(repository.shipment("SF-1003")?.currentState).toBe("ESCALATED");

    const overrideRun: any = await orchestrate("SF-1003", randomUUID(), true);
    const alternative = overrideRun.decision.options.find(
      (option: any) =>
        option.status === "viable" && option.id !== overrideRun.decision.recommendedOption,
    );
    expect(alternative).toBeTruthy();
    const overridden: any = await approve("SF-1003", "override", "approver", alternative.id);
    expect(overridden.decision.recommendedOption).toBe(alternative.id);
    expect(repository.shipment("SF-1003")?.currentState).toBe("COMMITTED");
  });

  it("requires two approval confirmations for a Tier 4 decision", async () => {
    const shipment = normalizeShipmentDraft(
      {
        id: "SF-TIER4",
        originCode: "AEJEA",
        destinationCode: "GBFXT",
        cargo: "Critical relief medicine",
        cargoCategory: "medicine",
        quantity: 12,
        quantityUnit: "tonnes",
        cargoValueUsd: 2_000_000,
        mode: "ocean",
        vessel: "MV Critical Test",
        etaIso: "2026-10-24T06:00:00.000Z",
        priority: "critical",
        constraints: ["War-risk approval may be denied in contested corridor", "No buffer stock"],
        downstreamCriticality: 3,
      },
      "Test editor",
    );
    repository.createShipment(shipment);
    try {
      const run: any = await orchestrate(shipment.id, randomUUID(), true);
      expect(run.decision.overallStatus).toBe("ESCALATED");
      expect(run.decision.secondaryApprovalRequired).toBe(true);

      const first: any = await approve(shipment.id, "approve", "approver");
      expect(first.status).toBe("SECONDARY_REVIEW_REQUIRED");
      expect(repository.shipment(shipment.id)?.currentState).toBe("PENDING_APPROVAL");

      const second: any = await approve(shipment.id, "approve", "approver");
      expect(second.actionId).toBeTruthy();
      expect(repository.shipment(shipment.id)?.currentState).toBe("COMMITTED");
    } finally {
      repository.deleteShipment(shipment.id);
    }
  });

  it("returns correct HTTP status and downloadable audit formats", async () => {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not bind");
      const base = `http://127.0.0.1:${address.port}`;

      expect((await fetch(`${base}/api/health`)).status).toBe(200);
      for (const shipment of shipments) {
        const response = await fetch(`${base}/api/shipments/${shipment.id}`);
        expect(response.status).toBe(200);
        expect(((await response.json()) as any).id).toBe(shipment.id);
      }
      expect((await fetch(`${base}/api/shipments/NOT-A-SHIPMENT`)).status).toBe(404);

      const csv = await fetch(`${base}/api/ledger/export?format=csv`);
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      expect(await csv.text()).toContain('"ai_reasoning"');

      const json = await fetch(`${base}/api/ledger/export?format=json`);
      expect(json.status).toBe(200);
      expect(json.headers.get("content-disposition")).toContain("sentinel-ledger");
      expect(((await json.json()) as any).appendOnly).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
