import { z } from "zod";
import type { DraftDecision, DraftOption } from "./rules";

const finiteNonNegative = z
  .number()
  .refine((n) => Number.isFinite(n) && n >= 0, "must be a finite non-negative number");

export const ModelOptionSchema = z.object({
  type: z.enum(["reroute", "respeed", "port_switch"]),
  label: z.string().min(3).max(160),
  description: z.string().min(3).max(400),
  cost_usd: finiteNonNegative,
  days_added: finiteNonNegative,
  fuel_pct: finiteNonNegative,
  fuel_tonnes: finiteNonNegative,
  risk_score: z.number().min(0).max(100),
  breaks_cold_chain: z.boolean(),
  introduces_cold_chain_leg: z.boolean().optional(),
  refusal_reason: z.string().max(400).nullable().optional(),
});

export const ModelDecisionSchema = z.object({
  options: z.array(ModelOptionSchema).length(3),
  do_nothing: z.object({
    cost_usd: finiteNonNegative,
    days_added: finiteNonNegative,
    risk_score: z.number().min(0).max(100),
    description: z.string().min(3).max(400),
  }),
  recommended_option_type: z.enum(["reroute", "respeed", "port_switch"]),
  rationale: z.string().min(10).max(1200),
  constraint_analysis: z.array(z.string().min(3).max(400)).min(1).max(6),
});

export type ModelDecision = z.infer<typeof ModelDecisionSchema>;

/** Schema validation + structural business validation of the model payload. */
export function validateModelDecision(
  raw: unknown,
  ctx: { shipmentId: string; coldChain: boolean },
): { ok: true; draft: DraftDecision } | { ok: false; reason: string } {
  const parsed = ModelDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? issue.path.join(".") : "payload";
    return {
      ok: false,
      reason: `schema validation failed at ${where}: ${issue?.message ?? "unknown"}`,
    };
  }
  const value = parsed.data;

  const types = new Set(value.options.map((o) => o.type));
  if (types.size !== 3) {
    return {
      ok: false,
      reason: "exactly one reroute, one respeed and one port_switch option are required",
    };
  }

  // Rule A guard: a cold-chain shipment whose decision flags nothing unsafe is not trustworthy.
  if (ctx.coldChain && !value.options.some((o) => o.breaks_cold_chain)) {
    return {
      ok: false,
      reason:
        "cold-chain shipment returned with no unsafe option identified — unsafe business decision",
    };
  }

  if (ctx.coldChain && value.options.every((o) => o.breaks_cold_chain)) {
    return { ok: false, reason: "no viable cold-chain-safe option returned" };
  }

  const options: DraftOption[] = value.options.map((o) => ({
    id: `${ctx.shipmentId}-${o.type}`,
    type: o.type,
    label: o.label,
    description: o.description,
    cost_usd: round2(o.cost_usd),
    days_added: round2(o.days_added),
    fuel_pct: round2(o.fuel_pct),
    fuel_tonnes: Math.round(o.fuel_tonnes),
    risk_score: Math.round(o.risk_score),
    breaksColdChain: o.breaks_cold_chain,
    ...(o.introduces_cold_chain_leg ? { introducesColdChainLeg: true } : {}),
    ...(o.refusal_reason ? { refusalHint: o.refusal_reason } : {}),
  }));

  return {
    ok: true,
    draft: {
      options,
      do_nothing: {
        cost_usd: round2(value.do_nothing.cost_usd),
        days_added: round2(value.do_nothing.days_added),
        risk_score: Math.round(value.do_nothing.risk_score),
        description: value.do_nothing.description,
      },
      recommended_option_id: `${ctx.shipmentId}-${value.recommended_option_type}`,
      rationale: value.rationale,
      constraint_analysis: value.constraint_analysis,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const DecideRequestSchema = z.object({
  shipmentId: z.string().regex(/^SF-\d{4}$/),
  requestId: z.string().min(8).max(64),
});
