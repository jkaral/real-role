import { and, eq } from "drizzle-orm";
import {
  CreateApplicationRequestSchema,
  normalizeTitle,
  normalizeCompany,
} from "@real-role/shared";
import { z } from "zod";
import { schema, type Db } from "@/db/client";
import {
  DEFAULT_PREFERENCES,
  JobFactsSchema,
  JobPreferencesSchema,
  type JobPreferences,
} from "@/lib/job-preferences";
import { createApplication, listApplications, toApplication } from "./applications";

export async function findSavedPosting(db: Db, userId: string, postingId: string) {
  const [row] = await db
    .select({ app: schema.trackedApplications, posting: schema.postings })
    .from(schema.trackedApplications)
    .innerJoin(schema.postings, eq(schema.postings.id, schema.trackedApplications.postingId))
    .where(
      and(
        eq(schema.trackedApplications.userId, userId),
        eq(schema.trackedApplications.postingId, postingId),
      ),
    )
    .limit(1);
  if (row) return toApplication(row.app, row.posting);
  const [target] = await db
    .select()
    .from(schema.postings)
    .where(eq(schema.postings.id, postingId))
    .limit(1);
  if (!target || !/^https?:\/\//.test(target.sourceUrl)) return null;
  // Imports have no description fingerprint; an exact URL plus employer/title can still identify the user's prior save.
  const candidates = await db
    .select({ app: schema.trackedApplications, posting: schema.postings })
    .from(schema.trackedApplications)
    .innerJoin(schema.postings, eq(schema.postings.id, schema.trackedApplications.postingId))
    .where(
      and(
        eq(schema.trackedApplications.userId, userId),
        eq(schema.postings.sourceUrl, target.sourceUrl),
      ),
    );
  const same = candidates.find(
    (candidate) =>
      normalizeTitle(candidate.posting.title) === normalizeTitle(target.title) &&
      normalizeCompany(candidate.posting.company) === normalizeCompany(target.company),
  );
  return same ? toApplication(same.app, same.posting) : null;
}

export const SaveShortlistSchema = z.object({
  postingId: z.string().min(1).max(100),
  facts: JobFactsSchema,
});

export async function readShortlist(db: Db, userId: string) {
  const [applications, rows, prefs] = await Promise.all([
    listApplications(db, userId),
    db
      .select({ id: schema.trackedJobFacts.applicationId, facts: schema.trackedJobFacts.values })
      .from(schema.trackedJobFacts)
      .innerJoin(
        schema.trackedApplications,
        eq(schema.trackedApplications.id, schema.trackedJobFacts.applicationId),
      )
      .where(eq(schema.trackedApplications.userId, userId)),
    db
      .select()
      .from(schema.jobPreferences)
      .where(eq(schema.jobPreferences.userId, userId))
      .limit(1),
  ]);
  return {
    applications,
    facts: Object.fromEntries(rows.map((row) => [row.id, JobFactsSchema.parse(row.facts)])),
    preferences: prefs[0] ? JobPreferencesSchema.parse(prefs[0].values) : DEFAULT_PREFERENCES,
  };
}

export async function writePreferences(db: Db, userId: string, input: JobPreferences) {
  const values = JobPreferencesSchema.parse(input);
  await db
    .insert(schema.jobPreferences)
    .values({ userId, values })
    .onConflictDoUpdate({
      target: schema.jobPreferences.userId,
      set: { values, updatedAt: new Date() },
    });
  return values;
}

export async function clearPreferences(db: Db, userId: string) {
  await db.delete(schema.jobPreferences).where(eq(schema.jobPreferences.userId, userId));
}

export async function saveToShortlist(
  db: Db,
  userId: string,
  input: z.infer<typeof SaveShortlistSchema>,
  now: Date,
) {
  const parsed = SaveShortlistSchema.parse(input);
  const existing = await findSavedPosting(db, userId, parsed.postingId);
  const result = existing
    ? { application: existing, created: false }
    : await createApplication(
        db,
        userId,
        CreateApplicationRequestSchema.parse({ postingId: parsed.postingId }),
        now,
      );
  // Re-saving never silently overwrites the facts previously captured by this user.
  await db
    .insert(schema.trackedJobFacts)
    .values({ applicationId: result.application.id, values: parsed.facts, updatedAt: now })
    .onConflictDoNothing();
  return result;
}
