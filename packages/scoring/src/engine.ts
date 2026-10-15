import {
  SIGNAL_IDS,
  type Confidence,
  type FreshnessBand,
  type ScoreResult,
  type ScoringWeights,
  type Signal,
} from "@real-role/shared";
import { BANDS, CONFIDENCE, DEFAULT_WEIGHTS, ENGINE_VERSION } from "./config";
import { postingAgeSignal } from "./signals/age";
import { careersPageSignal } from "./signals/careers";
import { hiringActivitySignal } from "./signals/hiring";
import { repostHistorySignal } from "./signals/repost";
import { specificitySignal } from "./signals/specificity";
import type { ScoreOptions, ScoringInput, SignalDraft } from "./types";
import { clamp, roundToTarget } from "./util";

const SIGNAL_FNS = [
  postingAgeSignal,
  repostHistorySignal,
  careersPageSignal,
  specificitySignal,
  hiringActivitySignal,
] as const;

export function bandFor(score: number): FreshnessBand {
  if (score >= BANDS.high) return "high";
  if (score >= BANDS.medium) return "medium";
  return "low";
}

export function resolveWeights(overrides?: Partial<ScoringWeights>): ScoringWeights {
  const weights = { ...DEFAULT_WEIGHTS };
  for (const id of SIGNAL_IDS) {
    const w = overrides?.[id];
    if (w !== undefined && Number.isFinite(w) && w >= 0) weights[id] = w;
  }
  return weights;
}

/**
 * Share of the total weight backed by solid evidence. Missing signals lower this (and so the
 * confidence) instead of the score.
 */
export function evidenceShare(drafts: readonly SignalDraft[], weights: ScoringWeights): number {
  const total = SIGNAL_IDS.reduce((sum, id) => sum + weights[id], 0);
  if (total <= 0) return 0;
  const backed = drafts.reduce(
    (sum, d) => sum + (d.value === null ? 0 : weights[d.id] * clamp(d.reliability)),
    0,
  );
  return backed / total;
}

export function confidenceFor(drafts: readonly SignalDraft[], weights: ScoringWeights): Confidence {
  const available = drafts.filter((d) => d.value !== null && weights[d.id] > 0).length;
  if (available < CONFIDENCE.minSignals) return "low";
  const share = evidenceShare(drafts, weights);
  if (share >= CONFIDENCE.high) return "high";
  if (share >= CONFIDENCE.medium) return "medium";
  return "low";
}

/**
 * Freshness Score, 0–100.
 *
 * Each available signal earns `weight × value` points, renormalized over the available signals so
 * missing data doesn't drag the score down. Points are rounded so the signals' `impact`s add up
 * exactly to `score` (A2: every point traces to a visible signal).
 */
export function computeScore(input: ScoringInput, options: ScoreOptions = {}): ScoreResult {
  const weights = resolveWeights(options.weights);
  const drafts = SIGNAL_FNS.map((fn) => fn(input));

  const counted = drafts.map((d) => d.value !== null && weights[d.id] > 0);
  const availableWeight = drafts.reduce((sum, d, i) => sum + (counted[i] ? weights[d.id] : 0), 0);

  const rawMax = drafts.map((d, i) =>
    counted[i] && availableWeight > 0 ? (100 * weights[d.id]) / availableWeight : 0,
  );
  const rawImpact = drafts.map((d, i) => (rawMax[i] ?? 0) * clamp(d.value ?? 0));

  const maxTotal = availableWeight > 0 ? 100 : 0;
  const maxImpact = roundToTarget(rawMax, maxTotal);
  const target = Math.round(rawImpact.reduce((a, b) => a + b, 0));
  const impact = roundToTarget(rawImpact, target, maxImpact);
  const score = impact.reduce((a, b) => a + b, 0);

  const signals: Signal[] = drafts.map((d, i) => ({
    id: d.id,
    label: d.label,
    value: d.value === null ? null : clamp(d.value),
    impact: impact[i] ?? 0,
    maxImpact: maxImpact[i] ?? 0,
    available: d.value !== null,
    detail: d.detail,
    explanation: d.explanation,
  }));

  return {
    score,
    band: bandFor(score),
    confidence: confidenceFor(drafts, weights),
    signals,
    computedAt: input.now.toISOString(),
    engineVersion: ENGINE_VERSION,
    usedLlm: Boolean(input.rubric),
  };
}
