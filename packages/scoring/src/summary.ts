import type { Confidence, FreshnessBand, ScoreResult } from "@real-role/shared";

export const BAND_LABELS: Record<FreshnessBand, string> = {
  high: "High freshness",
  medium: "Medium freshness",
  low: "Low freshness",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One neutral sentence for badges and listings, built only from signal details, e.g.
 * "Low freshness: seen 5 times over 60 days, posted 150 days ago."
 * High scores cite the strongest signals; others cite the ones that cost the most points.
 */
export function summarize(result: ScoreResult, maxReasons = 2): string {
  const available = result.signals.filter((s) => s.available && s.maxImpact > 0);
  const ranked =
    result.band === "high"
      ? available.filter((s) => (s.value ?? 0) >= 0.7).sort((a, b) => b.impact - a.impact)
      : available
          .filter((s) => (s.value ?? 1) < 0.5)
          .sort((a, b) => b.maxImpact - b.impact - (a.maxImpact - a.impact));
  const reasons = ranked.slice(0, maxReasons).map((s) => lowerFirst(s.detail));
  const label = BAND_LABELS[result.band];
  return reasons.length > 0 ? `${label}: ${reasons.join(", ")}.` : `${label}.`;
}
