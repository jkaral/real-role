import {
  defaultFollowUpAt,
  type CreateApplicationRequestSchema,
  type TrackedApplication,
  type UpdateApplicationRequest,
} from "@real-role/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";
import { HttpError } from "./http";
import { getPostingById, upsertPosting, type PostingRow } from "./postings";

type AppRow = typeof schema.trackedApplications.$inferSelect;
type CreateInput = z.output<typeof CreateApplicationRequestSchema>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toApplication(app: AppRow, posting: PostingRow): TrackedApplication {
  return {
    id: app.id,
    postingId: posting.id,
    title: posting.title,
    company: posting.company,
    sourceUrl: posting.sourceUrl,
    status: app.status,
    savedAt: app.savedAt.toISOString(),
    appliedAt: iso(app.appliedAt),
    followUpAt: iso(app.followUpAt),
    statusChangedAt: app.statusChangedAt.toISOString(),
    notes: app.notes,
    scoreAtSave: app.scoreAtSave,
    confidenceAtSave: app.confidenceAtSave,
  };
}

export async function listApplications(db: Db, userId: string): Promise<TrackedApplication[]> {
  const rows = await db
    .select({ app: schema.trackedApplications, posting: schema.postings })
    .from(schema.trackedApplications)
    .innerJoin(schema.postings, eq(schema.trackedApplications.postingId, schema.postings.id))
    .where(eq(schema.trackedApplications.userId, userId))
    .orderBy(desc(schema.trackedApplications.savedAt));
  return rows.map((r) => toApplication(r.app, r.posting));
}

/** Status changes that start the follow-up clock. */
function appliedFields(status: TrackedApplication["status"], appliedAt: Date | null, now: Date) {
  if (status !== "applied" || appliedAt) return {};
  return { appliedAt: now, followUpAt: defaultFollowUpAt(now) };
}

/** Save & track. Saving the same posting twice returns the existing item. */
export async function createApplication(
  db: Db,
  userId: string,
  input: CreateInput,
  now: Date,
): Promise<{ application: TrackedApplication; created: boolean }> {
  let posting: PostingRow | null = null;
  if (input.postingId) posting = await getPostingById(db, input.postingId);
  if (!posting && input.posting) posting = await upsertPosting(db, input.posting, now);
  if (!posting) throw new HttpError("not_found", "That posting wasn't found. Score it first.");

  const appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
  const [inserted] = await db
    .insert(schema.trackedApplications)
    .values({
      userId,
      postingId: posting.id,
      status: input.status,
      savedAt: now,
      statusChangedAt: now,
      appliedAt,
      followUpAt: input.followUpAt
        ? new Date(input.followUpAt)
        : appliedAt
          ? defaultFollowUpAt(appliedAt)
          : null,
      notes: input.notes ?? null,
      scoreAtSave: posting.lastScore,
      confidenceAtSave: posting.lastConfidence,
      ...appliedFields(input.status, appliedAt, now),
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { application: toApplication(inserted, posting), created: true };

  const [existing] = await db
    .select()
    .from(schema.trackedApplications)
    .where(
      and(
        eq(schema.trackedApplications.userId, userId),
        eq(schema.trackedApplications.postingId, posting.id),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Application insert conflicted but no row exists");
  return { application: toApplication(existing, posting), created: false };
}

async function getOwned(db: Db, userId: string, id: string) {
  const [row] = await db
    .select({ app: schema.trackedApplications, posting: schema.postings })
    .from(schema.trackedApplications)
    .innerJoin(schema.postings, eq(schema.trackedApplications.postingId, schema.postings.id))
    .where(
      and(eq(schema.trackedApplications.id, id), eq(schema.trackedApplications.userId, userId)),
    )
    .limit(1);
  // Someone else's id looks exactly like a missing one.
  if (!row) throw new HttpError("not_found", "Application not found.");
  return row;
}

export async function updateApplication(
  db: Db,
  userId: string,
  id: string,
  patch: UpdateApplicationRequest,
  now: Date,
): Promise<TrackedApplication> {
  const { app, posting } = await getOwned(db, userId, id);
  const statusChanged = patch.status !== undefined && patch.status !== app.status;
  const nextAppliedAt =
    patch.appliedAt === undefined
      ? app.appliedAt
      : patch.appliedAt
        ? new Date(patch.appliedAt)
        : null;
  const set: Partial<typeof schema.trackedApplications.$inferInsert> = {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(statusChanged ? { statusChangedAt: now } : {}),
    ...(patch.appliedAt !== undefined ? { appliedAt: nextAppliedAt } : {}),
    ...(patch.followUpAt !== undefined
      ? { followUpAt: patch.followUpAt ? new Date(patch.followUpAt) : null }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
  // Moving to "applied" starts the follow-up clock unless the caller set dates.
  if (statusChanged && patch.status === "applied" && patch.followUpAt === undefined) {
    Object.assign(set, appliedFields("applied", nextAppliedAt, now));
    if (nextAppliedAt && !app.followUpAt) set.followUpAt = defaultFollowUpAt(nextAppliedAt);
  }
  if (Object.keys(set).length === 0) return toApplication(app, posting);
  const [updated] = await db
    .update(schema.trackedApplications)
    .set(set)
    .where(eq(schema.trackedApplications.id, app.id))
    .returning();
  return toApplication(updated ?? app, posting);
}

export async function deleteApplication(db: Db, userId: string, id: string): Promise<void> {
  const { app } = await getOwned(db, userId, id);
  await db.delete(schema.trackedApplications).where(eq(schema.trackedApplications.id, app.id));
}
