import { fingerprint, roleKey, type ObserveResponse, type ParsedPosting } from "@real-role/shared";
import type { SightingsSummary } from "@real-role/scoring";
import { count, eq, max, min, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";

export type PostingRow = typeof schema.postings.$inferSelect;

/** Only real page URLs count as sightings; pasted text has no URL. */
export function isObservableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Insert or refresh a posting by fingerprint. Stores extracted fields only (A2). */
export async function upsertPosting(
  db: Db,
  posting: ParsedPosting,
  now: Date,
): Promise<PostingRow> {
  const fp = fingerprint(posting);
  const values = {
    fingerprint: fp,
    roleKey: roleKey(posting),
    title: posting.title,
    company: posting.company,
    companyDomain: posting.companyDomain ?? null,
    location: posting.location ?? null,
    postedAt: posting.postedAt ? new Date(posting.postedAt) : null,
    sourceUrl: posting.sourceUrl,
    source: posting.source,
    firstSeenAt: now,
    lastSeenAt: now,
  };
  const [row] = await db
    .insert(schema.postings)
    .values(values)
    .onConflictDoUpdate({
      target: schema.postings.fingerprint,
      set: {
        lastSeenAt: now,
        // Keep the first known values but fill gaps.
        companyDomain: sql`coalesce(${schema.postings.companyDomain}, excluded.company_domain)`,
        postedAt: sql`coalesce(${schema.postings.postedAt}, excluded.posted_at)`,
        location: sql`coalesce(${schema.postings.location}, excluded.location)`,
      },
    })
    .returning();
  if (!row) throw new Error("Posting upsert returned no row");
  return row;
}

/** Record one anonymous sighting (idempotent per role, URL and UTC day). */
export async function recordObservation(
  db: Db,
  posting: PostingRow,
  sourceUrl: string,
  now: Date,
): Promise<void> {
  if (!isObservableUrl(sourceUrl)) return;
  await db
    .insert(schema.observations)
    .values({
      roleKey: posting.roleKey,
      postingId: posting.id,
      sourceUrl,
      observedDay: now.toISOString().slice(0, 10),
      observedAt: now,
    })
    .onConflictDoNothing();
}

export async function getSightings(db: Db, key: string): Promise<SightingsSummary | null> {
  const [row] = await db
    .select({
      count: count(),
      first: min(schema.observations.observedAt),
      last: max(schema.observations.observedAt),
    })
    .from(schema.observations)
    .where(eq(schema.observations.roleKey, key));
  if (!row || row.count === 0 || !row.first || !row.last) return null;
  return {
    count: row.count,
    firstSeenAt: new Date(row.first).toISOString(),
    lastSeenAt: new Date(row.last).toISOString(),
  };
}

export async function observe(db: Db, posting: ParsedPosting, now: Date): Promise<ObserveResponse> {
  const row = await upsertPosting(db, posting, now);
  await recordObservation(db, row, posting.sourceUrl, now);
  const sightings = await getSightings(db, row.roleKey);
  return {
    postingId: row.id,
    fingerprint: row.fingerprint,
    roleKey: row.roleKey,
    sightings: sightings?.count ?? 0,
    firstSeenAt: sightings?.firstSeenAt ?? now.toISOString(),
    lastSeenAt: sightings?.lastSeenAt ?? now.toISOString(),
  };
}

export async function getPostingById(db: Db, id: string): Promise<PostingRow | null> {
  const [row] = await db.select().from(schema.postings).where(eq(schema.postings.id, id)).limit(1);
  return row ?? null;
}

/** Rebuild a ParsedPosting from a stored row (no description is stored). */
export function postingFromRow(row: PostingRow): ParsedPosting {
  return {
    title: row.title,
    company: row.company,
    ...(row.companyDomain ? { companyDomain: row.companyDomain } : {}),
    ...(row.location ? { location: row.location } : {}),
    ...(row.postedAt ? { postedAt: row.postedAt.toISOString() } : {}),
    descriptionText: "",
    sourceUrl: row.sourceUrl,
    source: row.source,
    parsedBy: "stored",
  };
}

/** Remember the latest score so saving by postingId can record it without re-scoring. */
export async function setLastScore(
  db: Db,
  postingId: string,
  score: number,
  confidence: PostingRow["lastConfidence"],
): Promise<void> {
  await db
    .update(schema.postings)
    .set({ lastScore: score, lastConfidence: confidence })
    .where(eq(schema.postings.id, postingId));
}
