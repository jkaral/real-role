import type { ParsedPosting } from "./posting";

/**
 * Fingerprinting spec (v1). Pure and synchronous so the extension, the API and the demo seed
 * all compute identical values.
 *
 * - `fingerprint` identifies a posting's content: normalized title + company + description.
 *   Same fingerprint seen again later = a repost of identical text.
 * - `roleKey` identifies the role loosely: normalized title + company + location. Reposts that
 *   tweak the description keep the same roleKey.
 */
export const FINGERPRINT_VERSION = "fp1";

const COMPANY_SUFFIXES =
  /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|gmbh|plc|sa|ag|bv|pty)\b\.?/g;

/** Lowercase, strip accents, turn punctuation into spaces, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTitle(title: string): string {
  // Drop bracketed noise like "(Remote)" or "[Hiring Now]" before normalizing.
  return normalizeText(title.replace(/[([{][^)\]}]*[)\]}]/g, " "));
}

export function normalizeCompany(company: string): string {
  return normalizeText(company.toLowerCase().replace(COMPANY_SUFFIXES, " "));
}

/** Description normalization drops digits so refreshed dates/requisition numbers don't change it. */
export function normalizeDescription(description: string): string {
  return normalizeText(description)
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 64-bit FNV-1a over UTF-16 code units, as 16 hex chars. */
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

type FingerprintInput = Pick<ParsedPosting, "title" | "company" | "descriptionText">;
type RoleKeyInput = Pick<ParsedPosting, "title" | "company" | "location">;

export function fingerprint(posting: FingerprintInput): string {
  const key = [
    normalizeTitle(posting.title),
    normalizeCompany(posting.company),
    normalizeDescription(posting.descriptionText),
  ].join("|");
  return `${FINGERPRINT_VERSION}_${fnv1a64(key)}`;
}

export function roleKey(posting: RoleKeyInput): string {
  const key = [
    normalizeTitle(posting.title),
    normalizeCompany(posting.company),
    normalizeText(posting.location ?? ""),
  ].join("|");
  return `${FINGERPRINT_VERSION}r_${fnv1a64(key)}`;
}
