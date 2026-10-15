import { PASTED_TEXT_URL, ParsedPostingSchema, type ParsedPosting } from "@real-role/shared";
import { HttpError } from "./http";

export const UNKNOWN_EMPLOYER = "Unknown employer";

const DAY_MS = 86_400_000;
const UNIT_DAYS = { day: 1, week: 7, month: 30 } as const;

/** "Posted 3 days ago", "posted today", "Posted on 2026-09-01" in pasted text. */
export function postedAtFromText(text: string, now: Date): string | undefined {
  if (/\bposted\s+(today|just now|\d+\s+hours?\s+ago)\b/i.test(text)) return now.toISOString();
  if (/\bposted\s+yesterday\b/i.test(text)) return new Date(now.getTime() - DAY_MS).toISOString();
  const rel = text.match(/\b(?:posted|reposted)\s+(\d{1,3})\+?\s+(day|week|month)s?\s+ago\b/i);
  if (rel?.[1] && rel[2]) {
    const unit = rel[2].toLowerCase() as keyof typeof UNIT_DAYS;
    return new Date(now.getTime() - Number(rel[1]) * UNIT_DAYS[unit] * DAY_MS).toISOString();
  }
  const abs = text.match(/\bposted(?:\s+on)?:?\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (abs?.[1] && Number.isFinite(Date.parse(abs[1]))) return new Date(abs[1]).toISOString();
  return undefined;
}

function firstLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && l.length <= 120);
}

/** Build a posting from text pasted on the check page. */
export function postingFromText(
  input: { text: string; title?: string | undefined; company?: string | undefined },
  now: Date,
): ParsedPosting {
  const text = input.text.trim();
  const title = input.title?.trim() || firstLine(text) || "Untitled role";
  const company = input.company?.trim() || UNKNOWN_EMPLOYER;
  const postedAt = postedAtFromText(text, now);
  const parsed = ParsedPostingSchema.safeParse({
    title: title.slice(0, 300),
    company: company.slice(0, 200),
    descriptionText: text.slice(0, 50_000),
    ...(postedAt ? { postedAt } : {}),
    sourceUrl: PASTED_TEXT_URL,
    source: "pasted_text",
    parsedBy: "pasted-text",
  });
  if (!parsed.success) {
    throw new HttpError("unparseable_posting", "We couldn't read that posting text.");
  }
  return parsed.data;
}
