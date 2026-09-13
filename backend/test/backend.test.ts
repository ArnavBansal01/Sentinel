/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { normalizeGdeltArticle } from "../src/connectors/news/gdeltConnector.js";
import { normalizeOpenMeteo } from "../src/connectors/weather/openMeteoConnector.js";
import { normalizeAisMessage } from "../src/connectors/ais/aisStreamConnector.js";
import { calculateConfidence } from "../src/agents/sense/confidence.js";
import { GeminiDecisionSchema } from "../src/agents/decide/decisionSchema.js";
import { applyPolicy } from "../src/policy/policyEngine.js";
import { shipments } from "../src/shipments/seed.js";
import { orchestrate, approve } from "../src/orchestrator.js";
import { repository } from "../src/persistence/database.js";
import { eventBus } from "../src/events/eventBus.js";
import type { Decision, Signal } from "../src/types/domain.js";
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
});
describe("integration", () => {
  beforeAll(() => {
    process.env["SENTINEL_MODE"] = "demo";
  });
  it("SF-1001 runs Sense-Decide-Policy-Act and is idempotent", async () => {
    const id = randomUUID(),
      a: any = await orchestrate("SF-1001", id),
      b: any = await orchestrate("SF-1001", id);
    expect(a.action.actionId).toBe(b.action.actionId);
    expect(repository.ledger().filter((x) => x.actionId === a.action.actionId)).toHaveLength(1);
  });
  it("SF-1002 refuses unsafe option and awaits approval", async () => {
    const x: any = await orchestrate("SF-1002", randomUUID());
    expect(x.decision.options.find((o: any) => o.type === "respeed").status).toBe("refused");
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
});
