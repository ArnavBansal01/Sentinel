import { config } from "../../config.js";
import type { Signal } from "../../types/domain.js";
export function calculateConfidence(signals: Signal[]) {
  const relevant = signals.filter((s) => s.confidence >= 0.5);
  const types = new Set(relevant.map((s) => s.type));
  const independent = new Set(relevant.map((s) => s.provider));
  const weighted = relevant.reduce(
    (n, s) =>
      n +
      ((config.confidence[s.type.toLowerCase() as keyof typeof config.confidence] as number) ??
        0.5) *
        s.confidence,
    0,
  );
  const base = relevant.length ? weighted / relevant.length : 0;
  const operational = ["AIS", "PORT", "WEATHER"].some((t) => types.has(t as Signal["type"]));
  const score = Math.min(
    0.99,
    base +
      Math.max(0, independent.size - 1) * config.confidence.corroborationBonus +
      (types.has("NEWS") && operational ? 0.1 : 0),
  );
  return {
    score: Math.round(score * 100) / 100,
    exists: score >= config.confidence.trigger,
    explanation: `${relevant.length} relevant signals from ${independent.size} independent providers across ${types.size} evidence types${types.has("NEWS") && operational ? "; news corroborated by operational evidence" : ""}.`,
  };
}
