import { AGE_CURVE } from "../config";
import type { ScoringInput, SignalDraft } from "../types";
import { daysBetween, formatDays, interpolate, parseDate } from "../util";
import { LABELS, unavailable } from "./common";

export function postingAgeSignal({ posting, careers, now }: ScoringInput): SignalDraft {
  const fromPage = parseDate(posting.postedAt);
  const fromBoard = careers?.match.matched ? parseDate(careers.match.role?.postedAt) : null;
  const posted = fromPage ?? fromBoard;
  if (!posted) {
    return unavailable(
      "posting_age",
      "No posted date",
      "The posting doesn't say when it was published, so its age isn't counted.",
    );
  }

  // A future date is clock skew or a scheduled post; treat it as brand new.
  const days = Math.max(0, daysBetween(posted, now));
  let value = interpolate(AGE_CURVE, days);

  const validThrough = parseDate(posting.validThrough);
  const closed = validThrough !== null && validThrough.getTime() < now.getTime();
  if (closed) value = Math.min(value, 0.1);

  const source = fromPage ? "" : " (date from the employer's careers page)";
  const detail = `Posted ${formatDays(days)}${closed ? "; listed closing date has passed" : ""}`;
  let explanation: string;
  if (closed) {
    explanation = "The posting lists a closing date that has already passed.";
  } else if (days <= 14) {
    explanation = "Recently posted roles are the most likely to be actively hiring.";
  } else if (days <= 45) {
    explanation =
      "Roles open for a month or so are often still active, but the odds drop over time.";
  } else {
    explanation = "Postings this old are less likely to still be actively hiring.";
  }

  return {
    id: "posting_age",
    label: LABELS.posting_age,
    value,
    detail,
    explanation: explanation + source,
    reliability: 1,
  };
}
