import type { ScoringWeights } from "@real-role/shared";

/** Bumped whenever weights, curves or heuristics change, so cached scores can be invalidated. */
export const ENGINE_VERSION = "scoring-1";

/** Relative weights (A3: high / high / high / medium / low–medium). The engine normalizes them. */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  posting_age: 30,
  repost_history: 25,
  careers_page_match: 25,
  description_specificity: 15,
  company_hiring_activity: 5,
};

/** Score thresholds for the display band. */
export const BANDS = { high: 70, medium: 40 } as const;

/** Evidence thresholds for confidence (share of total weight backed by solid data). */
export const CONFIDENCE = { high: 0.75, medium: 0.45, minSignals: 2 } as const;

/** [days since posted, sub-score]. Linear between points, flat beyond the ends. */
export const AGE_CURVE = [
  [0, 1],
  [7, 1],
  [14, 0.85],
  [30, 0.6],
  [60, 0.3],
  [90, 0.15],
  [180, 0.05],
] as const;

/** [days since Real Role first saw the role, sub-score]. Under 14 days is never penalized. */
export const REPOST_SPAN_CURVE = [
  [0, 1],
  [14, 1],
  [30, 0.6],
  [60, 0.3],
  [120, 0.1],
] as const;

/** Extra multiplier for repeated sightings once the span passes 14 days. */
export const REPOST_COUNT_MULTIPLIER = [
  { minCount: 4, factor: 0.7 },
  { minCount: 2, factor: 0.85 },
] as const;

/** A posted date this much newer than the first sighting suggests the role was re-listed. */
export const RELISTED_THRESHOLD_DAYS = 14;

/** [days since the board's latest role change, sub-score]. */
export const HIRING_RECENCY_CURVE = [
  [0, 1],
  [14, 1],
  [60, 0.6],
  [180, 0.3],
] as const;

/** Weight given to the LLM rubric when it's available; the rest is heuristics. */
export const LLM_BLEND = 0.5;

/** Confidence credit for partially reliable evidence. */
export const RELIABILITY = {
  /** Only one recent sighting: little history to go on. */
  thinHistory: 0.5,
  /** Specificity from heuristics alone (no LLM rubric). */
  heuristicsOnly: 0.75,
} as const;
