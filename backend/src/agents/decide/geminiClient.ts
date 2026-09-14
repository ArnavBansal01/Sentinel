import { GoogleGenAI } from "@google/genai";
import { GeminiDecisionSchema, optionTypes, type GeminiDecision } from "./decisionSchema.js";
import type { Shipment, DisruptionAssessment, OptionType } from "../../types/domain.js";
export async function askGemini(
  s: Shipment,
  d: DisruptionAssessment,
  selectedTypes: OptionType[],
): Promise<{ ok: true; value: GeminiDecision } | { ok: false; reason: string }> {
  if (!process.env["GEMINI_API_KEY"]) return { ok: false, reason: "missing_api_key" };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] });
    const response = await ai.models.generateContent({
      model: process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash",
      contents: `Explain exactly these three recovery options: ${selectedTypes.join(", ")}, plus doNothing, for this shipment. Do not substitute another option type.

Return JSON only and follow these numeric rules exactly:
- Numeric cost, delay, fuel, and risk fields are provisional. Sentinel recalculates them with its route-specific voyage estimator before policy evaluation.
- costUsd must be a finite number greater than or equal to 0.
- delayDays means additional delay versus the current plan. It must be greater than or equal to 0. If an option saves time, return 0; never return a negative number.
- fuelTonnes means the magnitude of additional bunker fuel versus the current plan. It must be greater than or equal to 0. Never express a reduction as a negative number.
- riskScore must be between 0 and 100.
- Use JSON numbers, never numeric strings, units, NaN, or Infinity.
- recommendedOption must identify a viable option and must not identify a refused option.
- Do not invent evidence beyond the supplied evidence package.

Shipment: ${JSON.stringify(s)}
Evidence: ${JSON.stringify(d)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          required: ["options", "doNothing", "recommendedOption", "reasoning"],
          properties: {
            options: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                required: [
                  "type",
                  "status",
                  "costUsd",
                  "delayDays",
                  "fuelTonnes",
                  "riskScore",
                  "reason",
                ],
                properties: {
                  type: { type: "string", enum: [...optionTypes] },
                  status: { type: "string", enum: ["viable", "refused"] },
                  costUsd: { type: "number", minimum: 0 },
                  delayDays: {
                    type: "number",
                    minimum: 0,
                    description: "Additional delay in days; use zero when time is saved",
                  },
                  fuelTonnes: {
                    type: "number",
                    minimum: 0,
                    description: "Magnitude of additional bunker fuel; never negative",
                  },
                  riskScore: { type: "number", minimum: 0, maximum: 100 },
                  reason: { type: "string" },
                },
              },
            },
            doNothing: {
              type: "object",
              required: ["costUsd", "delayDays", "fuelTonnes", "riskScore", "reason"],
              properties: {
                costUsd: { type: "number", minimum: 0 },
                delayDays: { type: "number", minimum: 0 },
                fuelTonnes: { type: "number", minimum: 0 },
                riskScore: { type: "number", minimum: 0, maximum: 100 },
                reason: { type: "string" },
              },
            },
            recommendedOption: { type: "string", enum: [...optionTypes] },
            reasoning: { type: "string" },
          },
        },
      },
    });
    const parsed = GeminiDecisionSchema.safeParse(JSON.parse(response.text ?? ""));
    const returnedTypes = parsed.success
      ? new Set(parsed.data.options.map((option) => option.type))
      : null;
    const matchesSelection =
      returnedTypes &&
      selectedTypes.every((type) => returnedTypes.has(type)) &&
      returnedTypes.size === selectedTypes.length;
    if (parsed.success && matchesSelection) return { ok: true, value: parsed.data };
    return {
      ok: false,
      reason: parsed.success
        ? "malformed_response:returned option types do not match the deterministic candidate set"
        : `malformed_response:${parsed.error.issues[0]?.message}`,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "provider_failed" };
  }
}
