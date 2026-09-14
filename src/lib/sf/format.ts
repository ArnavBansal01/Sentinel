import type { DecisionState, ShipmentStatus } from "./types";

export function usd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `$${Math.round(value / 1000)}K`;
  return `$${value.toLocaleString("en-US")}`;
}

export function usdExact(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function days(value: number): string {
  if (value === 0) return "0 d";
  return `${value > 0 ? "+" : ""}${value} d`;
}

export function dateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function timeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  on_track: "On track",
  monitoring: "Monitoring",
  disrupted: "Disrupted",
  pending_approval: "Pending approval",
  recovered: "Recovered",
  escalated: "Escalated",
};

export const DECISION_STATE_LABEL: Record<DecisionState, string> = {
  DECISION_READY: "Decision ready",
  AUTO_COMMITTED: "Auto-committed",
  PENDING_APPROVAL: "Pending approval",
  APPROVED_COMMITTED: "Approved — committed",
  OVERRIDDEN_COMMITTED: "Overridden — committed",
  REJECTED_ESCALATED: "Rejected — escalated",
};

export function approvalReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    TRANSIT_TIME_GT_7_DAYS: "Transit time exceeds seven days",
    CARGO_VALUE_AT_RISK_GT_1000000_USD: "Cargo value at risk exceeds $1 million",
    COLD_CHAIN_HUMAN_APPROVAL: "Temperature-controlled cargo requires human approval",
  };
  return labels[reason] ?? reason;
}
