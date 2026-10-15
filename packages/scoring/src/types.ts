import type {
  AtsBoard,
  AtsRole,
  MatchResult,
  ParsedPosting,
  ScoringWeights,
  SignalId,
} from "@real-role/shared";
import type { RubricResult } from "./rubric";

/** Observations of this posting's `roleKey` across Real Role users (from the `observations` table). */
export interface SightingsSummary {
  /** Distinct sightings (one per posting URL per day), including the current one. */
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/**
 * Result of checking the employer's own ATS board. Omit (or pass null) when no board was found
 * or the lookup failed: that's "unknown", which lowers confidence but never the score.
 */
export interface CareersEvidence {
  board: AtsBoard;
  roles: readonly AtsRole[];
  match: MatchResult;
}

/** Everything the engine needs. All I/O happens before this point. */
export interface ScoringInput {
  posting: ParsedPosting;
  /** Injected clock so scoring is deterministic. */
  now: Date;
  sightings?: SightingsSummary | null;
  careers?: CareersEvidence | null;
  /** LLM rubric for description specificity; omit to use heuristics alone. */
  rubric?: RubricResult | null;
}

export interface ScoreOptions {
  /** Override some or all weights (from config). */
  weights?: Partial<ScoringWeights>;
}

/** A signal before points are assigned. `value` null = couldn't be computed. */
export interface SignalDraft {
  id: SignalId;
  label: string;
  value: number | null;
  detail: string;
  explanation: string;
  /** 0–1: how much this signal's evidence should count toward confidence. */
  reliability: number;
}
