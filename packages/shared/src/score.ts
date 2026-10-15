import { z } from "zod";
import { IsoDateTimeSchema } from "./posting";

export const SIGNAL_IDS = [
  "posting_age",
  "repost_history",
  "careers_page_match",
  "description_specificity",
  "company_hiring_activity",
] as const;
export const SignalIdSchema = z.enum(SIGNAL_IDS);
export type SignalId = z.infer<typeof SignalIdSchema>;

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const ConfidenceSchema = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** Display band for the score. Wording in the UI must stay neutral ("Low freshness"), never "fake". */
export const FRESHNESS_BANDS = ["low", "medium", "high"] as const;
export const FreshnessBandSchema = z.enum(FRESHNESS_BANDS);
export type FreshnessBand = z.infer<typeof FreshnessBandSchema>;

/**
 * One explainable input to the score.
 *
 * Invariant (A2, "explainable over clever"): the sum of `impact` over all signals equals
 * `ScoreResult.score` (up to rounding), and `impact <= maxImpact`.
 */
export const SignalSchema = z.object({
  id: SignalIdSchema,
  /** Short UI label, e.g. "Posting age". */
  label: z.string().min(1),
  /** Normalized sub-score in [0, 1]; null when the signal couldn't be computed. */
  value: z.number().min(0).max(1).nullable(),
  /** Points this signal contributed to the final 0–100 score. 0 when unavailable. */
  impact: z.number().min(0).max(100),
  /** Most points this signal could have contributed given the signals available. */
  maxImpact: z.number().min(0).max(100),
  /** False when data was missing; unavailable signals lower confidence, not the score. */
  available: z.boolean(),
  /** Short factual value for the UI, e.g. "Posted 41 days ago" or "Seen 4 times in 60 days". */
  detail: z.string(),
  /** One or two neutral sentences explaining the signal. */
  explanation: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const ScoreResultSchema = z.object({
  /** 0–100 integer. */
  score: z.number().int().min(0).max(100),
  band: FreshnessBandSchema,
  confidence: ConfidenceSchema,
  signals: z.array(SignalSchema),
  computedAt: IsoDateTimeSchema,
  /** Scoring engine version, e.g. "scoring-1". */
  engineVersion: z.string(),
  /** True when the LLM rubric was used for description specificity. */
  usedLlm: z.boolean(),
});
export type ScoreResult = z.infer<typeof ScoreResultSchema>;

/** Relative weights per signal. They need not sum to 1; the engine normalizes. */
export const ScoringWeightsSchema = z.record(SignalIdSchema, z.number().nonnegative());
export type ScoringWeights = Record<SignalId, number>;
