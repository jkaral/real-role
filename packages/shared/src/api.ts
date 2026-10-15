import { z } from "zod";
import { ApplicationStatusSchema, TrackedApplicationSchema } from "./application";
import { IsoDateTimeSchema, ParsedPostingSchema } from "./posting";
import { ScoreResultSchema } from "./score";

/** API contract version. Bumped only through a `contract-change` PR. */
export const CONTRACT_VERSION = "0.1.0";

export const API_ROUTES = {
  score: "/api/score",
  observe: "/api/observe",
  applications: "/api/applications",
  application: (id: string) => `/api/applications/${encodeURIComponent(id)}`,
} as const;

/** Rate-limit response headers set on every API response. */
export const RATE_LIMIT_HEADERS = {
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  reset: "X-RateLimit-Reset",
} as const;

// ---------- Errors ----------

export const API_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "unparseable_posting",
  "upstream_unavailable",
  "internal",
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** Every non-2xx response has this body. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    /** zod issues or other structured detail; never secrets or stack traces. */
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------- POST /api/score ----------

/**
 * Three ways to ask for a score:
 * - `parsed`: the extension already parsed the page the user is viewing.
 * - `url`: the check page; the server fetches that single URL once (no crawling) and parses it.
 * - `text`: the check page with pasted posting text.
 */
export const ScoreRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("parsed"), posting: ParsedPostingSchema }),
  z.object({ kind: z.literal("url"), url: z.string().url().max(2048) }),
  z.object({
    kind: z.literal("text"),
    text: z.string().min(50).max(50_000),
    title: z.string().max(300).optional(),
    company: z.string().max(200).optional(),
  }),
]);
export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export const ScoreResponseSchema = z.object({
  postingId: z.string(),
  fingerprint: z.string(),
  /** The posting as the server understood it (useful for url/text requests). */
  posting: ParsedPostingSchema,
  result: ScoreResultSchema,
});
export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

// ---------- POST /api/observe ----------

/** Records that a posting was seen. Called by the extension when a posting page is viewed. */
export const ObserveRequestSchema = z.object({
  posting: ParsedPostingSchema,
});
export type ObserveRequest = z.infer<typeof ObserveRequestSchema>;

export const ObserveResponseSchema = z.object({
  postingId: z.string(),
  fingerprint: z.string(),
  roleKey: z.string(),
  /** Distinct sightings of this roleKey (one per posting URL/day), including this one. */
  sightings: z.number().int().nonnegative(),
  firstSeenAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
});
export type ObserveResponse = z.infer<typeof ObserveResponseSchema>;

// ---------- /api/applications (auth required) ----------

export const ListApplicationsResponseSchema = z.object({
  applications: z.array(TrackedApplicationSchema),
});
export type ListApplicationsResponse = z.infer<typeof ListApplicationsResponseSchema>;

/** Save & track. Either reference a posting already scored, or send the parsed posting. */
export const CreateApplicationRequestSchema = z
  .object({
    postingId: z.string().optional(),
    posting: ParsedPostingSchema.optional(),
    status: ApplicationStatusSchema.default("saved"),
    appliedAt: IsoDateTimeSchema.optional(),
    followUpAt: IsoDateTimeSchema.optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((v) => v.postingId !== undefined || v.posting !== undefined, {
    message: "Provide postingId or posting",
  });
export type CreateApplicationRequest = z.input<typeof CreateApplicationRequestSchema>;

export const ApplicationResponseSchema = z.object({
  application: TrackedApplicationSchema,
});
export type ApplicationResponse = z.infer<typeof ApplicationResponseSchema>;

/** PATCH /api/applications/:id. `null` clears a field. */
export const UpdateApplicationRequestSchema = z.object({
  status: ApplicationStatusSchema.optional(),
  appliedAt: IsoDateTimeSchema.nullable().optional(),
  followUpAt: IsoDateTimeSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type UpdateApplicationRequest = z.infer<typeof UpdateApplicationRequestSchema>;

// DELETE /api/applications/:id -> 204, no body.
