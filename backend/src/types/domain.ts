export type DataMode = "LIVE" | "DEMO" | "UNAVAILABLE";
export type Agent = "sense" | "decide" | "policy" | "act" | "ledger" | "system";
export type WorkflowState =
  | "MONITORED"
  | "SENSE_RUNNING"
  | "DISRUPTION_DETECTED"
  | "DECIDE_RUNNING"
  | "DECISION_READY"
  | "POLICY_CHECK"
  | "AUTO_COMMIT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ACT_RUNNING"
  | "COMMITTED"
  | "ESCALATED"
  | "POLICY_REFUSED";

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
  status: string;
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
  selectedRoute?: RoutePlan | undefined;
  currentState?: WorkflowState;
}
export interface RoutePlan {
  points: GeoPoint[];
  distanceNm: number;
  etaDeltaDays: number;
  fuelDeltaTonnes: number;
  riskScore: number;
}
export interface ProviderStatus {
  provider: string;
  status: DataMode;
  reason?: string;
}
export interface Signal {
  id: string;
  source: string;
  type: "NEWS" | "WEATHER" | "AIS" | "PORT";
  timestamp: string;
  location: string;
  confidence: number;
  title: string;
  description: string;
  url?: string;
  provider: string;
  dataStatus: DataMode;
  payload?: Record<string, unknown>;
}
export interface DisruptionAssessment {
  eventId: string;
  shipmentId: string;
  type: string;
  severity: number;
  confidence: number;
  location: string;
  detectedAt: string;
  exists: boolean;
  explanation: string;
  affectedSegments: string[];
  evidence: Signal[];
  providers: ProviderStatus[];
}
export type OptionType = "reroute" | "respeed" | "switch_mode";
export interface CostBreakdown {
  bunkerFuelUsdPerTonne: number;
  baselineFuelTonnes: number;
  optionFuelTonnes: number;
  fuelUsd: number;
  vesselTimeUsd: number;
  handlingUsd: number;
  cargoProtectionUsd: number;
  riskReserveUsd: number;
  method: "route_cost_v1";
}
export interface DecisionOption {
  id: string;
  type: OptionType;
  status: "viable" | "refused";
  costUsd: number;
  delayDays: number;
  fuelTonnes: number;
  riskScore: number;
  reason: string;
  policyReasons: string[];
  route?: RoutePlan;
  costBreakdown?: CostBreakdown;
}
export interface Decision {
  id: string;
  requestId: string;
  shipmentId: string;
  disruptionId: string;
  overallStatus: string;
  options: DecisionOption[];
  doNothing: {
    costUsd: number;
    delayDays: number;
    fuelTonnes: number;
    riskScore: number;
    reason: string;
    costBreakdown?: CostBreakdown;
  };
  recommendedOption: string | null;
  reasoning: string;
  provider: "gemini" | "deterministic_demo";
  providerStatus: "completed" | "provider_failed" | "demo";
  policyRulesTriggered: string[];
  createdAt: string;
  reviewDeadlineIso?: string;
  autoCommitAfterReview?: boolean;
}
export interface ActivityEvent {
  id: string;
  traceId: string;
  timestamp: string;
  agent: Agent;
  eventType: string;
  shipmentId: string;
  message: string;
  data?: unknown;
}
export interface LedgerEntry {
  id: string;
  traceId: string;
  timestamp: string;
  shipmentId: string;
  decisionId?: string;
  actionId?: string;
  eventType: string;
  actor: string;
  payload: unknown;
}
