import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";
import { HttpError, type RateLimitInfo } from "./http";

export const LIMITS = {
  score: { limit: 30, windowSeconds: 60 },
  scoreUrl: { limit: 10, windowSeconds: 60 },
  observe: { limit: 60, windowSeconds: 60 },
  applications: { limit: 120, windowSeconds: 60 },
} as const;
export type Bucket = keyof typeof LIMITS;

export function windowStart(nowMs: number, windowSeconds: number): number {
  const s = Math.floor(nowMs / 1000);
  return s - (s % windowSeconds);
}

/**
 * Fixed-window limiter backed by Postgres (no extra service). Increments atomically and throws
 * a 429 HttpError when over the limit. Returns header info either way.
 */
export async function rateLimit(
  db: Db,
  bucket: Bucket,
  client: string,
  nowMs = Date.now(),
): Promise<RateLimitInfo> {
  const { limit, windowSeconds } = LIMITS[bucket];
  const window = windowStart(nowMs, windowSeconds);
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key: `${bucket}:${client}`, window, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.window],
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });
  const count = row?.count ?? 1;
  const info: RateLimitInfo = { limit, remaining: limit - count, reset: window + windowSeconds };
  if (count > limit) {
    const error = new HttpError("rate_limited", "Too many requests. Try again shortly.");
    error.rate = info;
    throw error;
  }
  return info;
}

/** Old windows are useless; prune occasionally so the table stays small. */
export async function pruneRateLimits(db: Db, nowMs = Date.now()): Promise<void> {
  const cutoff = Math.floor(nowMs / 1000) - 3600;
  await db.delete(schema.rateLimits).where(sql`${schema.rateLimits.window} < ${cutoff}`);
}
