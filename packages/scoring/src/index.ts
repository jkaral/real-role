/**
 * @real-role/scoring — pure Freshness Score engine. No I/O: sightings, ATS evidence and the LLM
 * rubric are looked up by the caller and passed in. See docs/scoring.md.
 */
export { computeScore, bandFor, confidenceFor, evidenceShare, resolveWeights } from "./engine";
export { summarize, BAND_LABELS, CONFIDENCE_LABELS } from "./summary";
export { analyzeDescription, type DescriptionFeatures } from "./signals/specificity";
export {
  RUBRIC_VERSION,
  RUBRIC_SYSTEM_PROMPT,
  RUBRIC_JSON_SCHEMA,
  RubricResultSchema,
  buildRubricUserMessage,
  parseRubricResponse,
  rubricCacheKey,
  type RubricResult,
} from "./rubric";
export * from "./config";
export type {
  CareersEvidence,
  ScoreOptions,
  ScoringInput,
  SightingsSummary,
  SignalDraft,
} from "./types";
