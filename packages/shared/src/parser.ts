import type { JobSource, ParsedPosting } from "./posting";

/**
 * Extracts a posting from the DOM of a page the user is viewing (A2: never fetched server-side
 * by crawling). Runs in the extension content script and under jsdom in tests.
 * Implementations live in `@real-role/parsers` (owner: Codex).
 */
export interface PostingParser {
  /** Stable id recorded in `ParsedPosting.parsedBy`, e.g. "greenhouse". */
  readonly id: string;
  readonly source: JobSource;
  /** Cheap check: does this parser handle this page? `url` is the page URL. */
  canParse(url: string, document: Document): boolean;
  /**
   * Extract the posting, or null if the page isn't a single job posting.
   * `url` defaults to `document.URL`.
   */
  parse(document: Document, url?: string): ParsedPosting | null;
}

/** schema.org `JobPosting` JSON-LD fallback used when no board-specific parser matches. */
export type ParseGeneric = (document: Document, url?: string) => ParsedPosting | null;

/** Runs board parsers in order, then `parseGeneric`. Exported by `@real-role/parsers`. */
export type ParsePosting = (document: Document, url?: string) => ParsedPosting | null;
