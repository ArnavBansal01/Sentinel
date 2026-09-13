import { z } from "zod";
const n = z.number().finite().nonnegative();
export const GeminiDecisionSchema = z
  .object({
    options: z
      .array(
        z.object({
          type: z.enum(["reroute", "respeed", "switch_mode"]),
          status: z.enum(["viable", "refused"]),
          costUsd: n,
          delayDays: n,
          fuelTonnes: n,
          riskScore: z.number().finite().min(0).max(100),
          reason: z.string().min(3),
        }),
      )
      .length(3),
    doNothing: z.object({
      costUsd: n,
      delayDays: n,
      fuelTonnes: n,
      riskScore: z.number().finite().min(0).max(100),
      reason: z.string().min(3),
    }),
    recommendedOption: z.enum(["reroute", "respeed", "switch_mode"]),
    reasoning: z.string().min(10),
  })
  .superRefine((v, c) => {
    if (new Set(v.options.map((o) => o.type)).size !== 3)
      c.addIssue({ code: "custom", message: "exactly one option of each type is required" });
  });
export type GeminiDecision = z.infer<typeof GeminiDecisionSchema>;
