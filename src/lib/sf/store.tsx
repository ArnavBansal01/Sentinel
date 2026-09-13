import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { senseShipment } from "./connectors";
import { DEMO_USERS, SEED_ACTIVITY, SEED_LEDGER, SEED_SHIPMENTS } from "./seed";
import type {
  ActResult,
  ApprovalActionType,
  Decision,
  LedgerEntry,
  OperationalEvent,
  Role,
  Shipment,
  ShipmentStatus,
  User,
  WorkflowRun,
} from "./types";

/* ----------------------------------------------------------------- state */

interface SFState {
  user: User | null;
  shipments: Shipment[];
  runs: Record<string, WorkflowRun>;
  ledger: LedgerEntry[];
  activity: OperationalEvent[];
  generation: number;
}

function initialState(): SFState {
  return {
    user: null,
    shipments: structuredClone(SEED_SHIPMENTS),
    runs: {},
    ledger: structuredClone(SEED_LEDGER),
    activity: structuredClone(SEED_ACTIVITY),
    generation: 0,
  };
}

type Action =
  | { type: "login"; user: User }
  | { type: "logout" }
  | { type: "reset" }
  | { type: "run/start"; run: WorkflowRun }
  | { type: "run/patch"; shipmentId: string; generation: number; patch: Partial<WorkflowRun> }
  | { type: "shipment/status"; shipmentId: string; status: ShipmentStatus; risk?: number | undefined }
  | { type: "activity"; event: OperationalEvent }
  | { type: "ledger/append"; entry: LedgerEntry };

function reducer(state: SFState, action: Action): SFState {
  switch (action.type) {
    case "login":
      return { ...state, user: action.user };
    case "logout":
      return { ...state, user: null };
    case "reset":
      return { ...initialState(), user: state.user, generation: state.generation + 1 };
    case "run/start":
      return { ...state, runs: { ...state.runs, [action.run.shipmentId]: action.run } };
    case "run/patch": {
      const run = state.runs[action.shipmentId];
      // Stale-response protection: ignore anything from a superseded generation.
      if (!run || action.generation !== state.generation || run.version !== action.patch.version) {
        if (!run || action.generation !== state.generation) return state;
      }
      return {
        ...state,
        runs: { ...state.runs, [action.shipmentId]: { ...run, ...action.patch, version: run.version } },
      };
    }
    case "shipment/status":
      return {
        ...state,
        shipments: state.shipments.map((s) =>
          s.id === action.shipmentId
            ? { ...s, status: action.status, riskScore: action.risk ?? s.riskScore }
            : s,
        ),
      };
    case "activity":
      return { ...state, activity: [action.event, ...state.activity].slice(0, 60) };
    case "ledger/append":
      if (state.ledger.some((e) => e.reference === action.entry.reference)) return state;
      return { ...state, ledger: [action.entry, ...state.ledger] };
    default:
      return state;
  }
}

/* --------------------------------------------------------------- context */

interface SFContextValue {
  state: SFState;
  ready: boolean;
  login: (role: Role) => void;
  logout: () => void;
  reset: () => void;
  triggerScenario: (shipmentId: string) => Promise<void>;
  resolveApproval: (shipmentId: string, action: ApprovalActionType, optionId?: string, note?: string) => void;
  isBusy: (shipmentId: string) => boolean;
}

const SFContext = createContext<SFContextValue | null>(null);

const STORAGE_KEY = "sf.session.role";

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const generationRef = useRef(0);
  const inflight = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored === "planner" || stored === "approver") {
        const user = DEMO_USERS.find((u) => u.role === stored);
        if (user) dispatch({ type: "login", user });
      }
    } catch (e) {
      console.warn("Unable to access localStorage for session role", e);
    }
    setReady(true);
  }, []);

  const emit = useCallback(
    (event: Omit<OperationalEvent, "id" | "atIso"> & { atIso?: string }) => {
      dispatch({
        type: "activity",
        event: {
          id: `OE-${Math.random().toString(36).slice(2, 10)}`,
          atIso: event.atIso ?? new Date().toISOString(),
          ...event,
        },
      });
    },
    [],
  );

  const login = useCallback((role: Role) => {
    const user = DEMO_USERS.find((u) => u.role === role);
    if (!user) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, role);
    } catch (e) {
      console.warn("Unable to save session role to localStorage", e);
    }
    dispatch({ type: "login", user });
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Unable to remove session role from localStorage", e);
    }
    dispatch({ type: "logout" });
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    Object.values(inflight.current).forEach((c) => c.abort());
    inflight.current = {};
    setBusy({});
    dispatch({ type: "reset" });
  }, []);

  const triggerScenario = useCallback(
    async (shipmentId: string) => {
      if (inflight.current[shipmentId]) return; // duplicate-trigger protection
      const generation = generationRef.current;
      const controller = new AbortController();
      inflight.current[shipmentId] = controller;
      setBusy((b) => ({ ...b, [shipmentId]: true }));

      const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const disruption = senseShipment(shipmentId);

      try {
        if (!disruption) throw new Error("No disruption signal is seeded for this shipment.");

        const run: WorkflowRun = {
          shipmentId,
          requestId,
          version: generation,
          state: "DISRUPTION_DETECTED",
          startedAtIso: new Date().toISOString(),
          disruption,
          decision: null,
          approval: null,
          act: null,
          error: null,
        };
        dispatch({ type: "run/start", run });
        dispatch({ type: "shipment/status", shipmentId, status: "disrupted" });
        emit({
          stage: "sense",
          type: "Disruption detected",
          shipmentId,
          message: `${disruption.title}`,
          status: "warning",
        });
        emit({
          stage: "sense",
          type: "Source verification",
          shipmentId,
          message: `${disruption.sources.length} seeded sources correlated; AIS confirmation present.`,
          status: disruption.verified ? "success" : "warning",
        });

        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: { state: "SENSE_COMPLETE", version: generation },
        });
        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: { state: "DECISION_GENERATING", version: generation },
        });
        emit({
          stage: "decide",
          type: "Decision requested",
          shipmentId,
          message: "Recovery option set requested from the decision engine.",
          status: "info",
        });

        const res = await fetch("/api/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shipmentId, requestId }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Decision service returned an error.");
        const payload = (await res.json()) as { decision: Decision };
        const decision = payload.decision;

        if (generationRef.current !== generation) return; // stale after reset

        emit({
          stage: "validate",
          type: "Constraint check",
          shipmentId,
          message:
            decision.refusals.length > 0
              ? `${decision.refusals.length} option refused — ${decision.refusals[0]?.constraint}.`
              : "No hard constraint engaged; all options passed validation.",
          status: decision.refusals.length > 0 ? "danger" : "success",
        });

        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: { state: "DECISION_READY", decision, version: generation },
        });

        if (decision.overall_status === "PENDING_APPROVAL") {
          dispatch({
            type: "run/patch",
            shipmentId,
            generation,
            patch: { state: "PENDING_APPROVAL", decision, version: generation },
          });
          dispatch({ type: "shipment/status", shipmentId, status: "pending_approval" });
          emit({
            stage: "decide",
            type: "Approval required",
            shipmentId,
            message: decision.approval_reasons[0] ?? "Human approval threshold breached.",
            status: "warning",
          });
          return;
        }

        // Rule C — autonomous commit.
        const committed = decision.options.find((o) => o.id === decision.committed_option_id) ?? null;
        const act = buildAct(decision, committed?.label ?? "Do nothing (baseline retained)");
        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: { state: "AUTO_COMMITTED", decision, act, version: generation },
        });
        dispatch({ type: "shipment/status", shipmentId, status: "recovered", risk: committed?.risk_score });
        emit({
          stage: "act",
          type: "Decision committed",
          shipmentId,
          message: `${act.committedLabel} — committed autonomously.`,
          status: "success",
        });
        appendLedger(dispatch, {
          decision,
          shipment: findShipment(state.shipments, shipmentId),
          status: "AUTO_COMMITTED",
          actorType: "system",
          actorName: "SYSTEM / AUTONOMOUS",
          decisionLabel: act.committedLabel,
          reference: act.ledgerRef,
          evidence: disruption.sources,
        });
        emit({
          stage: "ledger",
          type: "Ledger updated",
          shipmentId,
          message: `Entry ${act.ledgerRef} written to the decision ledger.`,
          status: "info",
        });
      } catch (error) {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: {
            state: "ERROR",
            error:
              error instanceof Error && error.message
                ? error.message
                : "The decision workflow could not be completed.",
            version: generation,
          },
        });
        emit({
          stage: "decide",
          type: "Workflow error",
          shipmentId,
          message: "Decision unavailable — no state was committed.",
          status: "danger",
        });
      } finally {
        delete inflight.current[shipmentId];
        setBusy((b) => ({ ...b, [shipmentId]: false }));
      }
    },
    [emit, state.shipments],
  );

  const resolveApproval = useCallback(
    (shipmentId: string, action: ApprovalActionType, optionId?: string, note?: string) => {
      const run = state.runs[shipmentId];
      const user = state.user;
      if (!run || !run.decision || !user || user.role !== "approver") return;
      if (run.state !== "PENDING_APPROVAL") return; // double-approval protection

      const decision = run.decision;
      const generation = generationRef.current;
      const nowIso = new Date().toISOString();
      const shipment = findShipment(state.shipments, shipmentId);

      const approval = {
        type: action,
        actorId: user.id,
        actorName: `${user.name} (Approver)`,
        atIso: nowIso,
        note: note ?? "",
        ...(optionId ? { selectedOptionId: optionId } : {}),
      };

      if (action === "reject") {
        dispatch({
          type: "run/patch",
          shipmentId,
          generation,
          patch: {
            state: "REJECTED_ESCALATED",
            approval,
            decision: { ...decision, overall_status: "REJECTED_ESCALATED", committed_option_id: null },
            version: generation,
          },
        });
        dispatch({ type: "shipment/status", shipmentId, status: "escalated" });
        const ref = `ESC-${randomRef()}`;
        emit({
          stage: "act",
          type: "Decision rejected",
          shipmentId,
          message: `Recommendation rejected by ${approval.actorName}; escalated. Nothing committed.`,
          status: "warning",
        });
        appendLedger(dispatch, {
          decision: { ...decision, overall_status: "REJECTED_ESCALATED", committed_option_id: null },
          shipment,
          status: "REJECTED_ESCALATED",
          actorType: "human",
          actorName: approval.actorName,
          decisionLabel: "Rejected — no option committed, escalated",
          reference: ref,
          evidence: run.disruption.sources,
          approval,
        });
        return;
      }

      const targetId = action === "override" ? optionId : decision.recommended_option_id;
      const target = decision.options.find((o) => o.id === targetId);
      // Hard constraints cannot be overridden.
      if (!target || target.status === "refused") return;

      const status = action === "override" ? "OVERRIDDEN_COMMITTED" : "APPROVED_COMMITTED";
      const committedDecision: Decision = {
        ...decision,
        overall_status: status,
        committed_option_id: target.id,
      };
      const act = buildAct(committedDecision, target.label);
      dispatch({
        type: "run/patch",
        shipmentId,
        generation,
        patch: {
          state: status,
          approval,
          decision: committedDecision,
          act,
          version: generation,
        },
      });
      dispatch({ type: "shipment/status", shipmentId, status: "recovered", risk: target.risk_score });
      emit({
        stage: "act",
        type: action === "override" ? "Human override committed" : "Approved and committed",
        shipmentId,
        message: `${target.label} — committed by ${approval.actorName}.`,
        status: "success",
      });
      appendLedger(dispatch, {
        decision: committedDecision,
        shipment,
        status,
        actorType: "human",
        actorName: approval.actorName,
        decisionLabel:
          action === "override" ? `Override — ${target.label}` : target.label,
        reference: act.ledgerRef,
        evidence: run.disruption.sources,
        approval,
      });
      emit({
        stage: "ledger",
        type: "Ledger updated",
        shipmentId,
        message: `Entry ${act.ledgerRef} written to the decision ledger.`,
        status: "info",
      });
    },
    [emit, state.runs, state.shipments, state.user],
  );

  const value = useMemo<SFContextValue>(
    () => ({
      state,
      ready,
      login,
      logout,
      reset,
      triggerScenario,
      resolveApproval,
      isBusy: (id: string) => Boolean(busy[id]),
    }),
    [state, ready, login, logout, reset, triggerScenario, resolveApproval, busy],
  );

  return <SFContext.Provider value={value}>{children}</SFContext.Provider>;
}

export function useSentinel(): SFContextValue {
  const ctx = useContext(SFContext);
  if (!ctx) throw new Error("useSentinel must be used inside SentinelProvider");
  return ctx;
}

/* --------------------------------------------------------------- helpers */

function findShipment(shipments: Shipment[], id: string): Shipment {
  const s = shipments.find((x) => x.id === id) ?? SEED_SHIPMENTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shipment ${id}`);
  return s;
}

function randomRef(): string {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

function buildAct(decision: Decision, label: string): ActResult {
  return {
    committedOptionId: decision.committed_option_id ?? "do-nothing",
    committedLabel: label,
    executedAtIso: new Date().toISOString(),
    routeRedrawn: true,
    partnersNotified: ["Carrier operations", "Terminal agent", "Consignee planning"],
    ledgerRef: `ACT-${randomRef()}`,
    simulated: true,
  };
}

function appendLedger(
  dispatch: React.Dispatch<Action>,
  input: {
    decision: Decision;
    shipment: Shipment;
    status: LedgerEntry["status"];
    actorType: LedgerEntry["actorType"];
    actorName: string;
    decisionLabel: string;
    reference: string;
    evidence: LedgerEntry["snapshot"] extends undefined ? never : NonNullable<LedgerEntry["snapshot"]>["evidence"];
    approval?: NonNullable<LedgerEntry["snapshot"]>["approval"];
  },
) {
  const now = new Date();
  const entry: LedgerEntry = {
    id: `LG-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${input.reference.slice(-4)}`,
    timestampIso: now.toISOString(),
    shipmentId: input.shipment.id,
    lane: `${input.shipment.origin.name} → ${input.shipment.destination.name}`,
    decision: input.decisionLabel,
    status: input.status,
    actorType: input.actorType,
    actorName: input.actorName,
    reference: input.reference,
    rationale: input.decision.rationale,
    decisionSource: input.decision.source,
    seeded: false,
    snapshot: {
      options: input.decision.options,
      do_nothing: input.decision.do_nothing,
      recommended_option_id: input.decision.recommended_option_id,
      constraint_analysis: input.decision.constraint_analysis,
      approval_reasons: input.decision.approval_reasons,
      evidence: input.evidence,
      ...(input.approval ? { approval: input.approval } : {}),
    },
  };
  dispatch({ type: "ledger/append", entry });
}
