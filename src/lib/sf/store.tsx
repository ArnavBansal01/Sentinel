/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_USERS, SEED_ACTIVITY, SEED_LEDGER, SEED_SHIPMENTS } from "./seed";
import type {
  ActResult,
  ApprovalActionType,
  Decision,
  DisruptionEvent,
  LedgerEntry,
  OperationalEvent,
  Role,
  Shipment,
  User,
  WorkflowRun,
} from "./types";
interface SFState {
  user: User | null;
  shipments: Shipment[];
  runs: Record<string, WorkflowRun>;
  ledger: LedgerEntry[];
  activity: OperationalEvent[];
  generation: number;
  systemStatus: SystemStatus;
  lastError: string | null;
}
export interface SystemStatus {
  backend: "checking" | "healthy" | "unavailable";
  mode: "LIVE" | "DEMO" | "UNKNOWN";
  gemini: string;
  news: string;
  weather: string;
  ais: string;
  port: string;
  database: string;
}
interface SFContextValue {
  state: SFState;
  ready: boolean;
  login: (r: Role) => void;
  logout: () => void;
  reset: () => Promise<void>;
  injectDemoDisruption: (id: string) => Promise<void>;
  triggerScenario: (id: string, showcaseDemo?: boolean) => Promise<void>;
  resolveApproval: (id: string, a: ApprovalActionType, o?: string, n?: string) => Promise<void>;
  isBusy: (id: string) => boolean;
}
const Context = createContext<SFContextValue | null>(null),
  STORAGE_KEY = "sf.session.role",
  API = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8787";
const initial = (): SFState => ({
  user: null,
  shipments: structuredClone(SEED_SHIPMENTS),
  runs: {},
  ledger: [],
  activity: [],
  generation: 0,
  systemStatus: {
    backend: "checking",
    mode: "UNKNOWN",
    gemini: "checking",
    news: "checking",
    weather: "checking",
    ais: "checking",
    port: "checking",
    database: "checking",
  },
  lastError: null,
});
export function SentinelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const role = localStorage.getItem(STORAGE_KEY) as Role | null;
    if (role) {
      const user = DEMO_USERS.find((u) => u.role === role);
      if (user) setState((s) => ({ ...s, user }));
    }
    Promise.all([
      fetch(`${API}/api/shipments`).then((r) => r.json()),
      fetch(`${API}/api/activity`).then((r) => r.json()),
      fetch(`${API}/api/health`).then((r) => r.json()),
      fetch(`${API}/api/ledger`).then((r) => r.json()),
      fetch(`${API}/api/workflows`).then((r) => r.json()),
    ])
      .then(([shipments, events, systemStatus, ledger, workflows]) =>
        setState((s) => ({
          ...s,
          shipments: mergeShipments(shipments as Shipment[]),
          systemStatus,
          activity:
            systemStatus.mode === "DEMO"
              ? [...(events as BackendEvent[]).map(mapEvent), ...SEED_ACTIVITY]
              : [],
          ledger: [
            ...(ledger as any[]).map(mapBackendLedger),
            ...(systemStatus.mode === "DEMO" ? SEED_LEDGER : []),
          ],
          runs: Object.fromEntries(
            (workflows as any[]).map((workflow) => {
              const run = mapRun(workflow);
              if (workflow.persistedState === "ESCALATED") run.state = "REJECTED_ESCALATED";
              return [run.shipmentId, run];
            }),
          ),
        })),
      )
      .catch(() =>
        setState((s) => ({ ...s, systemStatus: { ...s.systemStatus, backend: "unavailable" } })),
      )
      .finally(() => setReady(true));
    const es = new EventSource(`${API}/api/events/stream`);
    es.addEventListener("activity", (e) => {
      const event = mapEvent(JSON.parse((e as MessageEvent).data));
      setState((s) => ({
        ...s,
        activity: [event, ...s.activity.filter((x) => x.id !== event.id)].slice(0, 200),
      }));
    });
    const healthPoll = window.setInterval(() => {
      fetch(`${API}/api/health`)
        .then((r) => r.json())
        .then((systemStatus) => setState((s) => ({ ...s, systemStatus })))
        .catch(() =>
          setState((s) => ({ ...s, systemStatus: { ...s.systemStatus, backend: "unavailable" } })),
        );
    }, 3000);
    return () => {
      es.close();
      window.clearInterval(healthPoll);
    };
  }, []);
  const login = useCallback((role: Role) => {
    const user = DEMO_USERS.find((u) => u.role === role);
    if (user) {
      localStorage.setItem(STORAGE_KEY, role);
      setState((s) => ({ ...s, user }));
    }
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState((s) => ({ ...s, user: null }));
  }, []);
  const reset = useCallback(async () => {
    const response = await fetch(`${API}/api/demo/reset`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Demo reset failed");
    setState((s) => ({
      ...initial(),
      user: s.user,
      shipments: mergeShipments(payload.shipments as Shipment[]),
      activity: (payload.activity as BackendEvent[]).map(mapEvent),
      ledger: (payload.ledger as any[]).map(mapBackendLedger),
      runs: Object.fromEntries(
        (payload.workflows as any[]).map((workflow) => {
          const run = mapRun(workflow);
          return [run.shipmentId, run];
        }),
      ),
      systemStatus: s.systemStatus,
      generation: s.generation + 1,
    }));
  }, []);
  const triggerScenario = useCallback(
    async (id: string, showcaseDemo = false) => {
      if (busy[id]) return;
      setBusy((b) => ({ ...b, [id]: true }));
      setState((s) => ({ ...s, lastError: null }));
      const requestId = crypto.randomUUID();
      try {
        const r = await fetch(`${API}/api/${showcaseDemo ? "demo/" : ""}orchestrate/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": requestId },
          body: JSON.stringify({ requestId }),
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.message ?? p.error);
        const run = mapRun(p);
        const persistedLedger = p.action
          ? await fetch(`${API}/api/ledger`).then((response) => response.json())
          : null;
        setState((s) => ({
          ...s,
          runs: { ...s.runs, [id]: run },
          shipments: s.shipments.map((x) => (x.id === id ? p.shipment : x)),
          ledger: persistedLedger
            ? [
                ...(persistedLedger as any[]).map(mapBackendLedger),
                ...(s.systemStatus.mode === "DEMO" ? SEED_LEDGER : []),
              ]
            : s.ledger,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          runs: {
            ...s.runs,
            [id]: {
              shipmentId: id,
              requestId,
              version: 0,
              state: "ERROR",
              startedAtIso: new Date().toISOString(),
              disruption: emptyDisruption(id),
              decision: null,
              approval: null,
              act: null,
              error: e instanceof Error ? e.message : "Workflow failed",
            },
          },
          lastError: e instanceof Error ? e.message : "Workflow failed",
        }));
      } finally {
        setBusy((b) => ({ ...b, [id]: false }));
      }
    },
    [busy],
  );
  const injectDemoDisruption = useCallback(
    async (id: string) => {
      if (busy[id]) return;
      setBusy((current) => ({ ...current, [id]: true }));
      setState((current) => ({ ...current, lastError: null }));
      try {
        const response = await fetch(`${API}/api/demo/disruption/${id}`, { method: "POST" });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.message ?? payload.error ?? "Could not add demo disruption");
        const run = mapRun(payload);
        setState((current) => ({
          ...current,
          runs: { ...current.runs, [id]: run },
          shipments: current.shipments.map((shipment) =>
            shipment.id === id ? payload.shipment : shipment,
          ),
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          lastError: error instanceof Error ? error.message : "Could not add demo disruption",
        }));
        throw error;
      } finally {
        setBusy((current) => ({ ...current, [id]: false }));
      }
    },
    [busy],
  );
  const resolveApproval = useCallback(
    async (id: string, action: ApprovalActionType, optionId?: string, note?: string) => {
      const user = state.user;
      if (user?.role !== "approver") throw new Error("Approver role is required.");
      setState((s) => ({ ...s, lastError: null }));
      const endpoint = action === "approve" ? "approval" : action;
      const r = await fetch(`${API}/api/${endpoint}/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": user.role },
        body: JSON.stringify({ optionId, note }),
      });
      const p = await r.json();
      if (!r.ok) {
        const message = p.message ?? p.error ?? "Approval action failed";
        setState((s) => ({ ...s, lastError: message }));
        throw new Error(message);
      }
      const persistedLedger = await fetch(`${API}/api/ledger`).then((response) => response.json());
      setState((s) => {
        const old = s.runs[id];
        if (!old) return s;
        if (action === "reject")
          return {
            ...s,
            runs: {
              ...s.runs,
              [id]: {
                ...old,
                state: "REJECTED_ESCALATED",
                approval: {
                  type: action,
                  actorId: user.id,
                  actorName: user.name,
                  atIso: new Date().toISOString(),
                  note: note ?? "",
                },
              },
            },
            shipments: s.shipments.map((x) => (x.id === id ? p.shipment : x)),
            ledger: [
              ...(persistedLedger as any[]).map(mapBackendLedger),
              ...(s.systemStatus.mode === "DEMO" ? SEED_LEDGER : []),
            ],
          };
        const decision = {
          ...old.decision!,
          committed_option_id: optionId ?? old.decision!.recommended_option_id,
          overall_status: action === "approve" ? "APPROVED_COMMITTED" : "OVERRIDDEN_COMMITTED",
        } as Decision;
        return {
          ...s,
          runs: {
            ...s.runs,
            [id]: { ...old, state: decision.overall_status, decision, act: mapAct(p) },
          },
          shipments: s.shipments.map((x) => (x.id === id ? p.shipment : x)),
          ledger: persistedLedger
            ? [
                ...(persistedLedger as any[]).map(mapBackendLedger),
                ...(s.systemStatus.mode === "DEMO" ? SEED_LEDGER : []),
              ]
            : [mapLedger(p), ...s.ledger],
        };
      });
    },
    [state.user],
  );
  const value = useMemo(
    () => ({
      state,
      ready,
      login,
      logout,
      reset,
      injectDemoDisruption,
      triggerScenario,
      resolveApproval,
      isBusy: (id: string) => !!busy[id],
    }),
    [
      state,
      ready,
      login,
      logout,
      reset,
      injectDemoDisruption,
      triggerScenario,
      resolveApproval,
      busy,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function mergeShipments(backend: Shipment[]): Shipment[] {
  const byId = new Map(backend.map((shipment) => [shipment.id, shipment]));
  const network = SEED_SHIPMENTS.map((seeded) => byId.get(seeded.id) ?? seeded);
  const known = new Set(network.map((shipment) => shipment.id));
  return [...network, ...backend.filter((shipment) => !known.has(shipment.id))];
}
export function useSentinel() {
  const c = useContext(Context);
  if (!c) throw new Error("useSentinel must be used inside SentinelProvider");
  return c;
}
type BackendEvent = {
  id: string;
  timestamp: string;
  agent: string;
  eventType: string;
  shipmentId: string;
  message: string;
};
function mapEvent(e: BackendEvent): OperationalEvent {
  return {
    id: e.id,
    atIso: e.timestamp,
    stage: e.agent === "policy" ? "validate" : (e.agent as OperationalEvent["stage"]),
    type: e.eventType,
    shipmentId: e.shipmentId,
    message: e.message,
    status:
      e.eventType.includes("refusal") || e.eventType.includes("detected")
        ? "warning"
        : e.eventType.includes("completed") || e.eventType.includes("updated")
          ? "success"
          : "info",
  };
}
function emptyDisruption(id: string): DisruptionEvent {
  return {
    id: "",
    shipmentId: id,
    title: "Workflow failed",
    category: "error",
    detectedAtIso: new Date().toISOString(),
    location: "",
    summary: "",
    verified: false,
    sources: [],
  };
}
function mapRun(p: any): WorkflowRun {
  const d = p.disruption;
  if (!p.decision) {
    return {
      shipmentId: p.shipment.id,
      requestId: p.requestId,
      version: 0,
      state: d.exists ? "DISRUPTION_DETECTED" : "SENSE_COMPLETE",
      startedAtIso: d.detectedAt,
      disruption: mapDisruption(d),
      decision: null,
      approval: null,
      act: null,
      error: null,
    };
  }
  const bd = p.decision;
  const mappedStatus = mapDecisionStatus(bd.overallStatus, Boolean(p.action));
  const decision: Decision = {
    id: bd.id,
    requestId: bd.requestId,
    shipmentId: bd.shipmentId,
    generatedAtIso: bd.createdAt,
    source: bd.provider === "gemini" ? "gemini" : "fallback",
    sourceNote: bd.providerStatus,
    options: bd.options.map((o: any) => ({
      id: o.id,
      type: o.type === "switch_mode" ? "switch_mode" : o.type,
      label: o.type.replace("_", " "),
      description: o.reason,
      cost_usd: o.costUsd,
      days_added: o.delayDays,
      fuel_pct: o.costBreakdown?.baselineFuelTonnes
        ? (o.fuelTonnes / o.costBreakdown.baselineFuelTonnes) * 100
        : 0,
      fuel_tonnes: o.fuelTonnes,
      risk_score: o.riskScore,
      status: o.status,
      refusal_reason: o.policyReasons[0],
      constraint: o.policyReasons[0],
      cost_breakdown: mapCostBreakdown(o.costBreakdown),
    })),
    do_nothing: {
      cost_usd: bd.doNothing.costUsd,
      days_added: bd.doNothing.delayDays,
      risk_score: bd.doNothing.riskScore,
      description: bd.doNothing.reason,
      cost_breakdown: mapCostBreakdown(bd.doNothing.costBreakdown),
    },
    recommended_option_id: bd.recommendedOption,
    committed_option_id: p.action ? bd.recommendedOption : null,
    overall_status: mappedStatus,
    rationale: bd.reasoning,
    constraint_analysis: bd.policyRulesTriggered.length
      ? bd.policyRulesTriggered
      : ["All deterministic policy rules evaluated."],
    approval_reasons: bd.policyRulesTriggered,
    refusals: bd.options
      .filter((o: any) => o.status === "refused")
      .map((o: any) => ({ optionId: o.id, reason: o.policyReasons[0], constraint: "cold-chain" })),
  };
  return {
    shipmentId: p.shipment.id,
    requestId: p.requestId,
    version: 0,
    state: mappedStatus,
    startedAtIso: d.detectedAt,
    disruption: mapDisruption(d),
    decision,
    approval: null,
    act: p.action ? mapAct(p.action) : null,
    error: null,
  };
}

function mapDisruption(d: any): DisruptionEvent {
  const location = d.location || "the route";
  return {
    id: d.eventId,
    shipmentId: d.shipmentId,
    title: d.exists ? `${d.type} at ${location}` : `No disruption found near ${location}`,
    category: d.exists ? d.type : "live_check",
    detectedAtIso: d.detectedAt,
    location,
    summary: d.exists
      ? d.explanation
      : `The live checks did not find enough reliable evidence of a disruption near ${location}.`,
    verified: d.exists,
    sources: d.evidence.map((e: any) => ({
      id: e.id,
      connector:
        e.type === "NEWS"
          ? "NewsConnector"
          : e.type === "WEATHER"
            ? "WeatherConnector"
            : e.type === "AIS"
              ? "AISConnector"
              : "PortConnector",
      label: e.title,
      publisher: `${e.provider} · ${e.dataStatus}`,
      observedAtIso: e.timestamp,
      summary: e.description,
      confidence: e.confidence,
      simulated: e.dataStatus !== "LIVE",
      dataStatus: e.dataStatus,
      provider: e.provider,
      url: e.url,
    })),
  };
}

function mapDecisionStatus(status: string, acted: boolean): Decision["overall_status"] {
  if (status === "AUTO_COMMIT") return acted ? "AUTO_COMMITTED" : "DECISION_READY";
  if (status === "APPROVED") return acted ? "APPROVED_COMMITTED" : "PENDING_APPROVAL";
  if (status === "OVERRIDDEN") return acted ? "OVERRIDDEN_COMMITTED" : "PENDING_APPROVAL";
  if (status === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (status === "POLICY_REFUSED") return "REJECTED_ESCALATED";
  return "DECISION_READY";
}
function mapAct(a: any): ActResult {
  return {
    committedOptionId: a.decision?.recommendedOption ?? "",
    committedLabel:
      a.decision?.options?.find((o: any) => o.id === a.decision.recommendedOption)?.type ??
      "Committed route",
    executedAtIso: new Date().toISOString(),
    routeRedrawn: true,
    partnersNotified: [a.notification?.delivery ?? "simulated_external_delivery"],
    ledgerRef: a.ledgerId ?? "",
    simulated: a.notification?.delivery !== "delivered",
  };
}
function mapLedger(a: any): LedgerEntry {
  return {
    id: a.ledgerId ?? crypto.randomUUID(),
    timestampIso: new Date().toISOString(),
    shipmentId: a.shipment?.id ?? "",
    lane: `${a.shipment?.origin?.name ?? ""} → ${a.shipment?.destination?.name ?? ""}`,
    decision:
      a.decision?.options?.find((o: any) => o.id === a.decision.recommendedOption)?.type ??
      "Decision",
    status: a.decision?.overallStatus === "AUTO_COMMIT" ? "AUTO_COMMITTED" : "APPROVED_COMMITTED",
    actorType: "system",
    actorName: "Backend orchestration",
    reference: a.ledgerId ?? "",
    rationale: a.decision?.reasoning ?? "",
    decisionSource: a.decision?.provider === "gemini" ? "gemini" : "fallback",
    seeded: false,
  };
}

function mapBackendLedger(entry: any): LedgerEntry {
  const payload = entry.payload ?? {};
  const decision = payload.decision ?? {};
  const shipment = payload.shipment ?? {};
  const selected = payload.selectedOption ?? {};
  const status: LedgerEntry["status"] =
    entry.eventType === "DECISION_REJECTED"
      ? "REJECTED_ESCALATED"
      : decision.overallStatus === "AUTO_COMMIT"
        ? "AUTO_COMMITTED"
        : decision.overallStatus === "OVERRIDDEN"
          ? "OVERRIDDEN_COMMITTED"
          : "APPROVED_COMMITTED";
  const evidence = (payload.disruption?.evidence ?? []).map((e: any) => ({
    id: e.id,
    connector:
      e.type === "NEWS"
        ? "NewsConnector"
        : e.type === "WEATHER"
          ? "WeatherConnector"
          : e.type === "AIS"
            ? "AISConnector"
            : "PortConnector",
    label: e.title,
    publisher: `${e.provider} · ${e.dataStatus}`,
    observedAtIso: e.timestamp,
    summary: e.description,
    confidence: e.confidence,
    simulated: e.dataStatus !== "LIVE",
    dataStatus: e.dataStatus,
    provider: e.provider,
    url: e.url,
  }));
  const options = (decision.options ?? []).map((o: any) => ({
    id: o.id,
    type: o.type === "switch_mode" ? "switch_mode" : o.type,
    label: o.type?.replace("_", " ") ?? "option",
    description: o.reason,
    cost_usd: o.costUsd,
    days_added: o.delayDays,
    fuel_pct: o.costBreakdown?.baselineFuelTonnes
      ? (o.fuelTonnes / o.costBreakdown.baselineFuelTonnes) * 100
      : 0,
    fuel_tonnes: o.fuelTonnes,
    risk_score: o.riskScore,
    status: o.status,
    refusal_reason: o.policyReasons?.[0],
    constraint: o.policyReasons?.[0],
    cost_breakdown: mapCostBreakdown(o.costBreakdown),
  }));
  return {
    id: entry.id,
    timestampIso: entry.timestamp,
    shipmentId: entry.shipmentId,
    lane: `${shipment.origin?.name ?? ""} → ${shipment.destination?.name ?? ""}`,
    decision: selected.type?.replace("_", " ") ?? entry.eventType,
    status,
    actorType: entry.actor?.startsWith("HUMAN") ? "human" : "system",
    actorName: entry.actor,
    reference: entry.id,
    rationale: decision.reasoning ?? "No model reasoning retained.",
    decisionSource: decision.provider === "gemini" ? "gemini" : "fallback",
    seeded: false,
    snapshot: {
      options,
      do_nothing: {
        cost_usd: decision.doNothing?.costUsd ?? 0,
        days_added: decision.doNothing?.delayDays ?? 0,
        risk_score: decision.doNothing?.riskScore ?? 0,
        description: decision.doNothing?.reason ?? "",
        cost_breakdown: mapCostBreakdown(decision.doNothing?.costBreakdown),
      },
      recommended_option_id: decision.recommendedOption ?? null,
      constraint_analysis: decision.policyRulesTriggered ?? [],
      approval_reasons: decision.policyRulesTriggered ?? [],
      evidence,
      traceId: entry.traceId,
      logs: (payload.logs ?? []).map(mapEvent),
      notification: payload.notification,
    },
  };
}

function mapCostBreakdown(value: any) {
  if (!value) return undefined;
  return {
    bunker_fuel_usd_per_tonne: value.bunkerFuelUsdPerTonne ?? 0,
    baseline_fuel_tonnes: value.baselineFuelTonnes ?? 0,
    option_fuel_tonnes: value.optionFuelTonnes ?? 0,
    fuel_usd: value.fuelUsd ?? 0,
    vessel_time_usd: value.vesselTimeUsd ?? 0,
    handling_usd: value.handlingUsd ?? 0,
    cargo_protection_usd: value.cargoProtectionUsd ?? 0,
    risk_reserve_usd: value.riskReserveUsd ?? 0,
    method: value.method ?? "route_cost_v1",
  };
}

export async function downloadLedger(format: "json" | "csv" = "json") {
  const response = await fetch(`${API}/api/ledger/export?format=${format}`);
  if (!response.ok) throw new Error("Ledger export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sentinel-ledger-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
