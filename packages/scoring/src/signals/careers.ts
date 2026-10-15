import type { ScoringInput, SignalDraft } from "../types";
import { clamp } from "../util";
import { LABELS, PROVIDER_NAMES, unavailable } from "./common";

export function careersPageSignal({ posting, careers }: ScoringInput): SignalDraft {
  if (!careers) {
    return unavailable(
      "careers_page_match",
      "Not checked",
      "We couldn't find the employer's public job board, so this wasn't checked.",
    );
  }

  const provider = PROVIDER_NAMES[careers.board.provider];
  const company = careers.board.companyName ?? posting.company;

  if (careers.match.matched) {
    return {
      id: "careers_page_match",
      label: LABELS.careers_page_match,
      value: 0.6 + 0.4 * clamp(careers.match.confidence),
      detail: "Listed on the employer's careers page",
      explanation:
        `The same role appears on ${company}'s ${provider} job board. ${careers.match.reason}`.trim(),
      reliability: 1,
    };
  }

  // An empty board can't be told apart from a failed lookup, so it's unknown, not a miss.
  if (careers.roles.length === 0) {
    return unavailable(
      "careers_page_match",
      "No roles listed",
      `${company}'s ${provider} job board returned no open roles, so we couldn't confirm either way.`,
    );
  }

  return {
    id: "careers_page_match",
    label: LABELS.careers_page_match,
    value: 0.1,
    detail: "Not found on the employer's careers page",
    explanation: `We didn't find this role among ${careers.roles.length} open roles on ${company}'s ${provider} job board. It may have been filled, renamed or listed elsewhere.`,
    reliability: 1,
  };
}
