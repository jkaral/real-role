import {
  RELIABILITY,
  RELISTED_THRESHOLD_DAYS,
  REPOST_COUNT_MULTIPLIER,
  REPOST_SPAN_CURVE,
} from "../config";
import type { ScoringInput, SignalDraft } from "../types";
import { daysBetween, interpolate, parseDate } from "../util";
import { LABELS, unavailable } from "./common";

const FRESH_SPAN_DAYS = 14;

export function repostHistorySignal({ posting, sightings, now }: ScoringInput): SignalDraft {
  const firstSeen = parseDate(sightings?.firstSeenAt);
  if (!sightings || !firstSeen) {
    return unavailable(
      "repost_history",
      "No history yet",
      "Real Role has no earlier observations of this role.",
    );
  }

  const count = Math.max(1, Math.floor(sightings.count));
  const spanDays = Math.max(0, daysBetween(firstSeen, now));
  const span = Math.round(spanDays);

  let value = 1;
  if (spanDays >= FRESH_SPAN_DAYS) {
    const factor = REPOST_COUNT_MULTIPLIER.find((m) => count >= m.minCount)?.factor ?? 1;
    value = interpolate(REPOST_SPAN_CURVE, spanDays) * factor;
  }

  const posted = parseDate(posting.postedAt);
  const relisted = posted !== null && daysBetween(firstSeen, posted) > RELISTED_THRESHOLD_DAYS;

  let detail: string;
  if (count <= 1) {
    detail = span <= 0 ? "First seen today" : `First seen ${span} days ago`;
  } else {
    detail = `Seen ${count} times over ${span} days`;
  }

  let explanation: string;
  if (spanDays < FRESH_SPAN_DAYS) {
    explanation =
      count <= 1
        ? "This is the first time Real Role has seen this role, so there's little history yet."
        : "Real Role first saw this role recently; no sign of long-running reposting.";
  } else {
    explanation =
      `Real Role first saw this role ${span} days ago` +
      (relisted ? ", before its current posted date" : "") +
      ". Roles listed or re-listed for a long time are less likely to be actively hiring.";
  }

  const thin = count <= 1 && spanDays < FRESH_SPAN_DAYS;
  return {
    id: "repost_history",
    label: LABELS.repost_history,
    value,
    detail,
    explanation,
    reliability: thin ? RELIABILITY.thinHistory : 1,
  };
}
