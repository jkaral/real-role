import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { schema, type Db } from "@/db/client";
import { JobFactsSchema } from "@/lib/job-preferences";
import { CoachItemSchema, InviteTokenSchema } from "@/lib/coach-contract";
import { HttpError } from "./http";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
async function requireOwned(db: Db, userId: string, applicationId: string) {
  const [app] = await db
    .select({ id: schema.trackedApplications.id })
    .from(schema.trackedApplications)
    .where(
      and(
        eq(schema.trackedApplications.id, applicationId),
        eq(schema.trackedApplications.userId, userId),
      ),
    )
    .limit(1);
  if (!app) throw new HttpError("not_found", "That application was not found.");
}
export async function managedShares(db: Db, userId: string, applicationId: string) {
  await requireOwned(db, userId, applicationId);
  const rows = await db
    .select({
      id: schema.coachShares.id,
      expiresAt: schema.coachShares.expiresAt,
      acceptedAt: schema.coachShares.acceptedAt,
      revokedAt: schema.coachShares.revokedAt,
      recipientName: schema.users.name,
    })
    .from(schema.coachShares)
    .innerJoin(
      schema.trackedApplications,
      eq(schema.trackedApplications.id, schema.coachShares.applicationId),
    )
    .leftJoin(schema.users, eq(schema.users.id, schema.coachShares.recipientId))
    .where(
      and(
        eq(schema.trackedApplications.userId, userId),
        eq(schema.coachShares.applicationId, applicationId),
      ),
    );
  return rows.map((r) => ({
    ...r,
    expiresAt: r.expiresAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));
}
export async function createCoachInvite(
  db: Db,
  userId: string,
  applicationId: string,
  now = new Date(),
) {
  const shares = await managedShares(db, userId, applicationId);
  if (
    shares.filter((s) => !s.revokedAt && (s.acceptedAt || Date.parse(s.expiresAt) > now.getTime()))
      .length >= 5
  )
    throw new HttpError(
      "bad_request",
      "Revoke an existing share before creating another (maximum five active shares per application).",
    );
  const token = randomBytes(32).toString("base64url"),
    expiresAt = new Date(now.getTime() + 7 * 86400000);
  const [row] = await db
    .insert(schema.coachShares)
    .values({ applicationId, inviteHash: hash(token), expiresAt })
    .returning({ id: schema.coachShares.id });
  if (!row) throw new Error("Invite insert failed");
  return { id: row.id, token, expiresAt: expiresAt.toISOString() };
}
async function pendingInvite(db: Db, token: string, now: Date) {
  InviteTokenSchema.parse(token);
  const [row] = await db
    .select({
      id: schema.coachShares.id,
      ownerId: schema.trackedApplications.userId,
      title: schema.postings.title,
      company: schema.postings.company,
      ownerName: schema.users.name,
      expiresAt: schema.coachShares.expiresAt,
    })
    .from(schema.coachShares)
    .innerJoin(
      schema.trackedApplications,
      eq(schema.trackedApplications.id, schema.coachShares.applicationId),
    )
    .innerJoin(schema.postings, eq(schema.postings.id, schema.trackedApplications.postingId))
    .innerJoin(schema.users, eq(schema.users.id, schema.trackedApplications.userId))
    .where(
      and(
        eq(schema.coachShares.inviteHash, hash(token)),
        isNull(schema.coachShares.revokedAt),
        isNull(schema.coachShares.recipientId),
        gt(schema.coachShares.expiresAt, now),
      ),
    )
    .limit(1);
  if (!row)
    throw new HttpError(
      "not_found",
      "This invitation is unavailable, expired or already accepted.",
    );
  return row;
}
export async function previewCoachInvite(db: Db, userId: string, token: string, now = new Date()) {
  const row = await pendingInvite(db, token, now);
  if (row.ownerId === userId)
    throw new HttpError(
      "bad_request",
      "You own this application. Share the invitation with the intended recipient.",
    );
  return {
    title: row.title,
    company: row.company,
    ownerName: row.ownerName,
    expiresAt: row.expiresAt.toISOString(),
  };
}
export async function acceptCoachInvite(db: Db, userId: string, token: string, now = new Date()) {
  const row = await pendingInvite(db, token, now);
  if (row.ownerId === userId)
    throw new HttpError("bad_request", "You cannot accept your own invitation.");
  const [accepted] = await db
    .update(schema.coachShares)
    .set({ recipientId: userId, acceptedAt: now })
    .where(
      and(
        eq(schema.coachShares.id, row.id),
        isNull(schema.coachShares.recipientId),
        isNull(schema.coachShares.revokedAt),
        gt(schema.coachShares.expiresAt, now),
      ),
    )
    .returning({ id: schema.coachShares.id });
  if (!accepted) throw new HttpError("not_found", "This invitation is no longer available.");
  return accepted;
}
export async function revokeCoachShare(db: Db, userId: string, shareId: string, now = new Date()) {
  const [row] = await db
    .select({ applicationId: schema.coachShares.applicationId })
    .from(schema.coachShares)
    .innerJoin(
      schema.trackedApplications,
      eq(schema.trackedApplications.id, schema.coachShares.applicationId),
    )
    .where(and(eq(schema.coachShares.id, shareId), eq(schema.trackedApplications.userId, userId)))
    .limit(1);
  if (!row) throw new HttpError("not_found", "That share was not found.");
  await db
    .update(schema.coachShares)
    .set({ revokedAt: now })
    .where(eq(schema.coachShares.id, shareId));
}
export async function receivedCoachShares(db: Db, userId: string) {
  const rows = await db
    .select({
      id: schema.coachShares.id,
      title: schema.postings.title,
      company: schema.postings.company,
      sourceUrl: schema.postings.sourceUrl,
      status: schema.trackedApplications.status,
      scoreAtSave: schema.trackedApplications.scoreAtSave,
      confidenceAtSave: schema.trackedApplications.confidenceAtSave,
      ownerName: schema.users.name,
      facts: schema.trackedJobFacts.values,
    })
    .from(schema.coachShares)
    .innerJoin(
      schema.trackedApplications,
      eq(schema.trackedApplications.id, schema.coachShares.applicationId),
    )
    .innerJoin(schema.postings, eq(schema.postings.id, schema.trackedApplications.postingId))
    .innerJoin(schema.users, eq(schema.users.id, schema.trackedApplications.userId))
    .leftJoin(
      schema.trackedJobFacts,
      eq(schema.trackedJobFacts.applicationId, schema.trackedApplications.id),
    )
    .where(
      and(
        eq(schema.coachShares.recipientId, userId),
        isNull(schema.coachShares.revokedAt),
        isNotNull(schema.coachShares.acceptedAt),
      ),
    );
  return rows.map((row) =>
    CoachItemSchema.parse({ ...row, facts: JobFactsSchema.parse(row.facts ?? {}) }),
  );
}
