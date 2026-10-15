/**
 * @real-role/parsers — DOM parsers behind the `PostingParser` contract (owner: Codex).
 *
 * Phase 1 stub: the export shape below is fixed; implementations replace the stub bodies.
 * Required exports: `parsers`, `parseGeneric`, `parsePosting`.
 * Parsers read only the DOM they are given (A2); they never fetch.
 */
import type { ParseGeneric, ParsePosting, PostingParser } from "@real-role/shared";

/** Board-specific parsers, tried in order before the generic fallback. */
export const parsers: readonly PostingParser[] = [];

/** schema.org JobPosting JSON-LD fallback. */
export const parseGeneric: ParseGeneric = () => null;

export const parsePosting: ParsePosting = (document, url) => {
  const pageUrl = url ?? document.URL;
  for (const parser of parsers) {
    if (parser.canParse(pageUrl, document)) {
      const posting = parser.parse(document, pageUrl);
      if (posting) return posting;
    }
  }
  return parseGeneric(document, pageUrl);
};
