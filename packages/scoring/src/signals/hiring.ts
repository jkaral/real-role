import { HIRING_RECENCY_CURVE } from "../config";
import type { ScoringInput, SignalDraft } from "../types";
import { daysBetween, formatDays, interpolate, parseDate, plural } from "../util";
import { LABELS, unavailable } from "./common";

export function hiringActivitySignal({ careers, now }: ScoringInput): SignalDraft {
  if (!careers || careers.roles.length === 0) {
    return unavailable(
      "company_hiring_activity",
      "Not checked",
      "We couldn't see the employer's open roles, so overall hiring activity isn't counted.",
    );
  }

  const n = careers.roles.length;
  let latest: Date | null = null;
  for (const role of careers.roles) {
    const d = parseDate(role.updatedAt ?? role.postedAt);
    if (d && (!latest || d > latest)) latest = d;
  }

  if (!latest) {
    return {
      id: "company_hiring_activity",
      label: LABELS.company_hiring_activity,
      value: n >= 5 ? 0.7 : 0.5,
      detail: `${plural(n, "open role")}`,
      explanation: "The employer's job board lists open roles but doesn't show when they changed.",
      reliability: 1,
    };
  }

  const days = Math.max(0, daysBetween(latest, now));
  return {
    id: "company_hiring_activity",
    label: LABELS.company_hiring_activity,
    value: interpolate(HIRING_RECENCY_CURVE, days),
    detail: `${plural(n, "open role")}; latest change ${formatDays(days)}`,
    explanation: "Employers that are adding or updating roles are more likely to be hiring now.",
    reliability: 1,
  };
}
