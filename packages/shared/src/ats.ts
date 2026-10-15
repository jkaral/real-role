import { z } from "zod";
import { IsoDateTimeSchema } from "./posting";
import type { ParsedPosting } from "./posting";

export const ATS_PROVIDERS = ["greenhouse", "lever", "ashby", "workday"] as const;
export const AtsProviderIdSchema = z.enum(ATS_PROVIDERS);
export type AtsProviderId = z.infer<typeof AtsProviderIdSchema>;

/** An employer's public job board on an ATS. */
export const AtsBoardSchema = z.object({
  provider: AtsProviderIdSchema,
  /** Provider-specific board identifier (Greenhouse board token, Lever site, Ashby org slug). */
  boardToken: z.string().min(1),
  /** Public URL of the board. */
  boardUrl: z.string().url(),
  companyName: z.string().optional(),
});
export type AtsBoard = z.infer<typeof AtsBoardSchema>;

/** One open role as listed on the employer's own ATS board. */
export const AtsRoleSchema = z.object({
  provider: AtsProviderIdSchema,
  id: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  department: z.string().optional(),
  url: z.string().url(),
  postedAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});
export type AtsRole = z.infer<typeof AtsRoleSchema>;

export const MATCH_METHODS = ["external_id", "exact_title", "fuzzy_title", "none"] as const;

export const MatchResultSchema = z.object({
  matched: z.boolean(),
  role: AtsRoleSchema.optional(),
  /** 0–1 confidence in the match. */
  confidence: z.number().min(0).max(1),
  method: z.enum(MATCH_METHODS),
  /** Neutral, user-facing reason, e.g. "Same title and location listed on the employer's board." */
  reason: z.string(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

/** Injected I/O so adapters stay testable (mock with msw) and the API can enforce timeouts. */
export interface AtsContext {
  fetch: typeof fetch;
  signal?: AbortSignal;
}

/**
 * One ATS integration. Uses only the provider's public, official job-board API (A2).
 * Implementations live in `@real-role/ats` (owner: Codex).
 */
export interface AtsAdapter {
  readonly id: AtsProviderId;
  /**
   * Resolve a company domain, careers URL or ATS board URL to a board on this provider,
   * or null if this provider doesn't host it. Must not crawl: at most a few direct API lookups.
   */
  detect(companyDomainOrUrl: string, ctx?: AtsContext): Promise<AtsBoard | null>;
  /** All currently open roles on the board. */
  listOpenRoles(board: AtsBoard, ctx?: AtsContext): Promise<AtsRole[]>;
  /** Pure: is this posting listed among the roles? (fuzzy title + location match) */
  findMatch(posting: ParsedPosting, roles: readonly AtsRole[]): MatchResult;
}
