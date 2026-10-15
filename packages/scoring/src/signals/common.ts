import type { SignalId } from "@real-role/shared";
import type { SignalDraft } from "../types";

export const LABELS: Record<SignalId, string> = {
  posting_age: "Posting age",
  repost_history: "Repost history",
  careers_page_match: "Careers page",
  description_specificity: "Description detail",
  company_hiring_activity: "Company hiring activity",
};

export function unavailable(id: SignalId, detail: string, explanation: string): SignalDraft {
  return { id, label: LABELS[id], value: null, detail, explanation, reliability: 0 };
}

export const PROVIDER_NAMES = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
} as const;
