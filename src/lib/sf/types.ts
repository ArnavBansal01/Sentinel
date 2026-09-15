/** Sentinel Flash domain model. */

export type Role = "planner" | "approver" | "editor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
}

export type ShipmentStatus =
  "on_track" | "monitoring" | "disrupted" | "pending_approval" | "recovered" | "escalated";

export interface GeoPoint {
  name: string;
  code: string;
  lat: number;
  lon: number;
}

export interface Shipment {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  position: { lat: number; lon: number };
  cargo: string;
  cargoValueUsd: number;
  mode: "ocean" | "air" | "rail";
  vessel: string;
  etaIso: string;
  riskScore: number;
  status: ShipmentStatus;
  coldChain: boolean;
  constraints: string[];
  demoScenario: boolean;
  cargoCategory?: string;
  quantity?: number;
  quantityUnit?: "units" | "kg" | "tonnes" | "pallets" | "containers" | "litres";
  temperatureMinC?: number;
  temperatureMaxC?: number;
  priority?: "standard" | "high" | "critical";
  reference?: string;
  owner?: string;
  notes?: string;
  createdAtIso?: string;
  createdBy?: string;
  shelfLifeDays?: number;
  downstreamCriticality?: 0 | 1 | 2 | 3;
}

export interface ShipmentDraft {
  id?: string;
  originCode: string;
  destinationCode: string;
  cargo: string;
  cargoCategory:
    | "medicine"
    | "electronics"
    | "food"
    | "chemicals"
    | "automotive"
    | "textiles"
    | "machinery"
    | "other";
  quantity: number;
  quantityUnit: "units" | "kg" | "tonnes" | "pallets" | "containers" | "litres";
  cargoValueUsd: number;
  mode: "ocean" | "air" | "rail";
  vessel: string;
  etaIso: string;
  temperatureMinC?: number | null;
  temperatureMaxC?: number | null;
  priority: "standard" | "high" | "critical";
  reference?: string;
  owner?: string;
  notes?: string;
  constraints: string[];
  shelfLifeDays?: number;
  downstreamCriticality?: 0 | 1 | 2 | 3;
}

export interface EvidenceSource {
  id: string;
  connector: "NewsConnector" | "WeatherConnector" | "AISConnector" | "PortConnector";
  label: string;
  publisher: string;
  observedAtIso: string;
  summary: string;
  confidence: number;
  simulated: boolean;
  dataStatus?: "LIVE" | "DEMO" | "UNAVAILABLE";
  provider?: string;
  url?: string;
}

export interface DisruptionEvent {
  id: string;
  shipmentId: string;
  title: string;
  category: string;
  detectedAtIso: string;
  location: string;
  summary: string;
  verified: boolean;
  sources: EvidenceSource[];
}

export type OptionType = "reroute" | "respeed" | "port_switch" | "hold_and_wait" | "accept_loss";
export type OptionStatus = "viable" | "refused";

export interface RiskCriterion {
  key: string;
  label: string;
  score: number;
  detail: string;
  included_in_total: boolean;
}

export interface RiskAssessment {
  tier: 1 | 2 | 3 | 4;
  label: "Negligible" | "Low" | "Elevated" | "Critical";
  score: number;
  criteria: RiskCriterion[];
  hard_overrides: string[];
  behavior: "AUTO_COMMIT" | "AUTO_COMMIT_NOTIFY" | "PENDING_APPROVAL" | "ESCALATED";
}

export interface CostBreakdown {
  bunker_fuel_usd_per_tonne: number;
  baseline_fuel_tonnes: number;
  option_fuel_tonnes: number;
  fuel_usd: number;
  vessel_time_usd: number;
  handling_usd: number;
  cargo_protection_usd: number;
  risk_reserve_usd: number;
  method: string;
}

export interface RecoveryOption {
  id: string;
  type: OptionType;
  label: string;
  description: string;
  cost_usd: number;
  days_added: number;
  fuel_pct: number;
  fuel_tonnes: number;
  risk_score: number;
  status: OptionStatus;
  refusal_reason?: string;
  constraint?: string;
  cost_breakdown?: CostBreakdown | undefined;
  feasibility?: "confirmed" | "uncertain" | "unavailable";
  risk_assessment?: RiskAssessment;
  guidance?: {
    title: string;
    route_text: string;
    destination: GeoPoint;
    steps: string[];
    onward_leg?: string;
    confirmation_required: boolean;
  };
}

export interface DoNothingBaseline {
  cost_usd: number;
  days_added: number;
  risk_score: number;
  description: string;
  cost_breakdown?: CostBreakdown | undefined;
}

export type DecisionState =
  | "DECISION_READY"
  | "AUTO_COMMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED_COMMITTED"
  | "OVERRIDDEN_COMMITTED"
  | "REJECTED_ESCALATED";

export type DecisionSource = "gemini" | "fallback";

export interface Decision {
  id: string;
  requestId: string;
  shipmentId: string;
  generatedAtIso: string;
  source: DecisionSource;
  sourceNote?: string;
  options: RecoveryOption[];
  do_nothing: DoNothingBaseline;
  recommended_option_id: string | null;
  committed_option_id: string | null;
  overall_status: DecisionState;
  rationale: string;
  constraint_analysis: string[];
  approval_reasons: string[];
  refusals: { optionId: string; reason: string; constraint: string }[];
  review_deadline_iso?: string;
  auto_commit_after_review?: boolean;
  secondary_approval_required?: boolean;
  approval_steps_completed?: number;
}

export type ApprovalActionType = "approve" | "reject" | "override";

export interface ApprovalAction {
  type: ApprovalActionType;
  actorId: string;
  actorName: string;
  atIso: string;
  note: string;
  selectedOptionId?: string;
}

export interface ActResult {
  committedOptionId: string;
  committedLabel: string;
  executedAtIso: string;
  routeRedrawn: boolean;
  partnersNotified: string[];
  ledgerRef: string;
  simulated: boolean;
}

export interface LedgerEntry {
  id: string;
  timestampIso: string;
  shipmentId: string;
  lane: string;
  decision: string;
  status: DecisionState;
  actorType: "system" | "human";
  actorName: string;
  reference: string;
  rationale: string;
  decisionSource: DecisionSource;
  seeded: boolean;
  snapshot?: {
    options: RecoveryOption[];
    do_nothing: DoNothingBaseline;
    recommended_option_id: string | null;
    constraint_analysis: string[];
    approval_reasons: string[];
    evidence: EvidenceSource[];
    approval?: ApprovalAction;
    approvals?: ApprovalAction[];
    traceId?: string;
    logs?: OperationalEvent[];
    notification?: { delivery?: string; provider?: string };
  };
}

export type WorkflowStage = "sense" | "decide" | "validate" | "act";

export interface OperationalEvent {
  id: string;
  atIso: string;
  stage: WorkflowStage | "ledger";
  type: string;
  shipmentId: string;
  message: string;
  status: "info" | "success" | "warning" | "danger";
  seeded?: boolean;
}

export type RunState =
  | "NORMAL"
  | "DISRUPTION_DETECTED"
  | "SENSE_COMPLETE"
  | "DECISION_GENERATING"
  | "DECISION_READY"
  | "AUTO_COMMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED_COMMITTED"
  | "OVERRIDDEN_COMMITTED"
  | "REJECTED_ESCALATED"
  | "ERROR";

export interface WorkflowRun {
  shipmentId: string;
  requestId: string;
  version: number;
  state: RunState;
  startedAtIso: string;
  disruption: DisruptionEvent;
  decision: Decision | null;
  approval: ApprovalAction | null;
  act: ActResult | null;
  error: string | null;
}
