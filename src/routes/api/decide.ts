import { createFileRoute } from "@tanstack/react-router";

import { fallbackDraft } from "@/lib/sf/fallback";
import { normalizeDecision } from "@/lib/sf/rules";
import { DecideRequestSchema, validateModelDecision } from "@/lib/sf/schema";
import { SEED_DISRUPTIONS, SEED_SHIPMENTS } from "@/lib/sf/seed";
import type { Decision, Shipment } from "@/lib/sf/types";

/**
 * Governance invariants for the reference scenarios. The model may propose any
 * economics it likes, but the resulting governance outcome must remain the one
 * the operating model guarantees for these lanes. A breach means the proposal is
 * not usable, so the deterministic decision is applied instead.
 */
function journeyInvariantBreach(shipmentId: string, decision: Decision): string | null {
  if (shipmentId === "SF-1001" && decision.overall_status !== "AUTO_COMMITTED") {
    return "low-risk lane must resolve autonomously";
  }
  if (shipmentId === "SF-1002") {
    if (decision.refusals.length === 0) return "cold-chain lane returned no refused option";
    if (decision.overall_status !== "AUTO_COMMITTED") {
      return "cold-chain lane must commit a viable alternative autonomously";
    }
  }
  if (shipmentId === "SF-1003" && decision.overall_status !== "PENDING_APPROVAL") {
    return "high-value lane must be held for human approval";
  }
  return null;
}

export const Route = createFileRoute("/api/decide")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Malformed request body." }, { status: 400 });
        }

        const parsed = DecideRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid decision request." }, { status: 400 });
        }

        const { shipmentId, requestId } = parsed.data;
        const shipment = SEED_SHIPMENTS.find((s) => s.id === shipmentId);
        if (!shipment) {
          return Response.json({ error: "Unknown shipment." }, { status: 404 });
        }

        console.info(`${shipmentId} decision started`);
        const nowIso = new Date().toISOString();

        const model = await generateModelDecision(shipment);
        if (model.ok) {
          const validated = validateModelDecision(model.payload, {
            shipmentId,
            coldChain: shipment.coldChain,
          });
          if (validated.ok) {
            const decision = normalizeDecision({
              shipment,
              draft: validated.draft,
              requestId,
              source: "gemini",
              sourceNote: model.note,
              nowIso,
            });
            const breach = journeyInvariantBreach(shipmentId, decision);
            if (!breach) {
              console.info(`${shipmentId} model decision validated`);
              return Response.json({ decision });
            }
            console.warn(`${shipmentId} governance invariant failed: ${breach} — fallback selected`);
            return Response.json({
              decision: normalizeDecision({
                shipment,
                draft: fallbackDraft(shipment),
                requestId,
                source: "fallback",
                sourceNote: `Model output rejected (${breach}). Deterministic decision applied.`,
                nowIso,
              }),
            });
          }
          console.warn(`${shipmentId} validation failed: ${validated.reason} — fallback selected`);
          const decision = normalizeDecision({
            shipment,
            draft: fallbackDraft(shipment),
            requestId,
            source: "fallback",
            sourceNote: `Model output rejected (${validated.reason}). Deterministic decision applied.`,
            nowIso,
          });
          return Response.json({ decision });
        }

        console.warn(`${shipmentId} model unavailable (${model.reason}) — fallback selected`);
        const decision = normalizeDecision({
          shipment,
          draft: fallbackDraft(shipment),
          requestId,
          source: "fallback",
          sourceNote: `Decision provider unavailable (${model.reason}). Deterministic decision applied.`,
          nowIso,
        });
        return Response.json({ decision });
      },
    },
  },
});

type ModelResult =
  | { ok: true; payload: unknown; note: string }
  | { ok: false; reason: string };

const SYSTEM_PROMPT = `You are the decision engine inside Sentinel Flash, an autonomous supply-chain disruption control tower.

You MUST return structured JSON only, matching the requested schema. No prose, no markdown.

You must evaluate exactly three recovery strategies: reroute, respeed, switch_mode.
You must also evaluate "do nothing" as the economic baseline, directly comparable with the recovery options.
You must respect the shipment's operational constraints.
Cold-chain violations must be flagged with breaks_cold_chain=true and a concrete refusal_reason; they must never be recommended.
You must not invent unsupported operational facts and must not fabricate evidence beyond the evidence supplied.
All numeric fields must be numbers, never strings. Risk scores are integers between 0 and 100. Costs are finite, non-negative USD.
Distinguish clearly between options that are viable and options that must be refused.
The application independently validates your output and enforces all business rules; you do not control commitment.`;

function buildUserPrompt(shipment: Shipment): string {
  const event = SEED_DISRUPTIONS[shipment.id];
  const evidence =
    event?.sources.map((s) => `- [${s.connector}] ${s.label}: ${s.summary}`).join("\n") ??
    "- No verified evidence on record.";
  return `SHIPMENT
id: ${shipment.id}
lane: ${shipment.origin.name} -> ${shipment.destination.name}
cargo: ${shipment.cargo}
cargo_value_usd: ${shipment.cargoValueUsd}
mode: ${shipment.mode}
eta: ${shipment.etaIso}
current_risk_score: ${shipment.riskScore}
cold_chain: ${shipment.coldChain}
constraints:
${shipment.constraints.map((c) => `- ${c}`).join("\n") || "- none"}

DISRUPTION
${event ? `${event.title} (${event.category}) at ${event.location}. ${event.summary}` : "Unclassified disruption signal."}

VERIFIED EVIDENCE (seeded demo connectors)
${evidence}

Return JSON with this exact shape:
{
  "options": [
    {"type":"reroute"|"respeed"|"switch_mode","label":string,"description":string,
     "cost_usd":number,"days_added":number,"fuel_pct":number,"fuel_tonnes":number,
     "risk_score":number,"breaks_cold_chain":boolean,"introduces_cold_chain_leg":boolean,
     "refusal_reason":string|null}
  ],
  "do_nothing": {"cost_usd":number,"days_added":number,"risk_score":number,"description":string},
  "recommended_option_type": "reroute"|"respeed"|"switch_mode",
  "rationale": string,
  "constraint_analysis": [string]
}

NUMERIC RULES (a response breaking any of these is rejected):
- Exactly three options: one "reroute", one "respeed", one "switch_mode".
- cost_usd, days_added, fuel_pct, fuel_tonnes must all be finite numbers that are ZERO OR GREATER.
  Express fuel_pct and fuel_tonnes as the MAGNITUDE of the bunker change versus plan, never negative.
  Express days_added as additional days versus plan; use 0 when an option saves or keeps time.
- risk_score is an integer 0-100. Emit raw numbers, never strings, units, or thousands separators.`;
}

async function generateModelDecision(shipment: Shipment): Promise<ModelResult> {
  const directKey = process.env["GEMINI_API_KEY"];
  const gatewayKey = process.env["LOVABLE_API_KEY"];
  const prompt = buildUserPrompt(shipment);

  try {
    if (directKey) {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": directKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(18_000),
        },
      );
      if (!res.ok) return { ok: false, reason: `provider status ${res.status}` };
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { ok: false, reason: "empty provider response" };
      return { ok: true, payload: JSON.parse(text), note: "Gemini 2.5 Flash (direct API)" };
    }

    if (gatewayKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Lovable-API-Key": gatewayKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(18_000),
      });
      if (!res.ok) return { ok: false, reason: `provider status ${res.status}` };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content;
      if (!text) return { ok: false, reason: "empty provider response" };
      return { ok: true, payload: JSON.parse(text), note: "Gemini 3.8 Flash (Lovable AI Gateway)" };
    }

    return { ok: false, reason: "no decision provider configured" };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "network error";
    return { ok: false, reason };
  }
}
