import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../src/db/client";
import { createUser, resetDb, testDb } from "./db";
import {
  createCoachInvite,
  previewCoachInvite,
  acceptCoachInvite,
  revokeCoachShare,
  managedShares,
  receivedCoachShares,
} from "../src/server/coach";
import { saveToShortlist, writePreferences } from "../src/server/shortlist";
import { upsertPosting } from "../src/server/postings";
import { deleteApplication, updateApplication } from "../src/server/applications";
import { DEFAULT_PREFERENCES } from "../src/lib/job-preferences";
let db: Db, close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());
const now = new Date("2026-10-15T12:00:00Z");
async function fixture() {
  const owner = await createUser(db, "Owner"),
    coach = await createUser(db, "Coach"),
    other = await createUser(db, "Other");
  const posting = await upsertPosting(
    db,
    {
      title: "Platform Engineer",
      company: "Bramblecrest Analytics",
      sourceUrl: "https://bramblecrest.example/jobs/42",
      source: "generic",
      descriptionText: "Private original description",
      parsedBy: "test",
    },
    now,
  );
  const saved = await saveToShortlist(
    db,
    owner,
    {
      postingId: posting.id,
      facts: { location: "Toronto", salary: { max: 130000, currency: "CAD", period: "year" } },
    },
    now,
  );
  await updateApplication(
    db,
    owner,
    saved.application.id,
    { notes: "Never share private notes" },
    now,
  );
  await writePreferences(db, owner, { ...DEFAULT_PREFERENCES, titles: "Private preference" });
  return { owner, coach, other, app: saved.application };
}
describe("read-only coach sharing boundaries", () => {
  it("stores only a hashed secret and discloses the explicitly shared projection after acceptance", async () => {
    const { owner, coach, other, app } = await fixture();
    const invite = await createCoachInvite(db, owner, app.id, now);
    const [stored] = await db.select().from(schema.coachShares);
    expect(stored?.inviteHash).not.toBe(invite.token);
    expect(stored?.inviteHash).toHaveLength(64);
    expect(await receivedCoachShares(db, coach)).toEqual([]);
    expect(await previewCoachInvite(db, coach, invite.token, now)).toMatchObject({
      title: app.title,
      company: app.company,
      ownerName: "Owner",
    });
    await acceptCoachInvite(db, coach, invite.token, now);
    const shared = await receivedCoachShares(db, coach);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.facts.location).toBe("Toronto");
    expect(JSON.stringify(shared)).not.toMatch(
      /Never share|Private preference|Private original|inviteHash|recipientId|userId/,
    );
    expect(await receivedCoachShares(db, other)).toEqual([]);
    expect(await managedShares(db, owner, app.id)).toMatchObject([{ recipientName: "Coach" }]);
    await expect(
      updateApplication(db, coach, app.id, { notes: "Tampered" }, now),
    ).rejects.toThrow();
  });
  it("rejects unrelated management, self-acceptance, bad and expired invitations", async () => {
    const { owner, coach, other, app } = await fixture();
    await expect(createCoachInvite(db, other, app.id, now)).rejects.toThrow();
    await expect(managedShares(db, other, app.id)).rejects.toThrow();
    const invite = await createCoachInvite(db, owner, app.id, now);
    await expect(acceptCoachInvite(db, owner, invite.token, now)).rejects.toThrow();
    await expect(previewCoachInvite(db, coach, "A".repeat(43), now)).rejects.toThrow();
    await expect(
      acceptCoachInvite(db, coach, invite.token, new Date(now.getTime() + 7 * 86400000)),
    ).rejects.toThrow();
    await expect(revokeCoachShare(db, other, invite.id, now)).rejects.toThrow();
  });
  it("binds a single-use invitation atomically and revokes access on the next read", async () => {
    const { owner, coach, other, app } = await fixture();
    const invite = await createCoachInvite(db, owner, app.id, now);
    const outcomes = await Promise.allSettled([
      acceptCoachInvite(db, coach, invite.token, now),
      acceptCoachInvite(db, other, invite.token, now),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(
      (await receivedCoachShares(db, coach)).length + (await receivedCoachShares(db, other)).length,
    ).toBe(1);
    await expect(acceptCoachInvite(db, coach, invite.token, now)).rejects.toThrow();
    await revokeCoachShare(db, owner, invite.id, now);
    expect(await receivedCoachShares(db, coach)).toEqual([]);
    expect(await receivedCoachShares(db, other)).toEqual([]);
  });
  it("blocks revoked pending links and cascades application and recipient deletions", async () => {
    const { owner, coach, app } = await fixture();
    const revoked = await createCoachInvite(db, owner, app.id, now);
    await revokeCoachShare(db, owner, revoked.id, now);
    await expect(acceptCoachInvite(db, coach, revoked.token, now)).rejects.toThrow();
    const invite = await createCoachInvite(db, owner, app.id, now);
    await acceptCoachInvite(db, coach, invite.token, now);
    await db.delete(schema.users).where(eq(schema.users.id, coach));
    expect((await managedShares(db, owner, app.id)).some((s) => s.id === invite.id)).toBe(false);
    await deleteApplication(db, owner, app.id);
    expect(await db.select().from(schema.coachShares)).toEqual([]);
  });
  it("limits active shares on an application", async () => {
    const { owner, app } = await fixture();
    for (let i = 0; i < 5; i++) await createCoachInvite(db, owner, app.id, now);
    await expect(createCoachInvite(db, owner, app.id, now)).rejects.toThrow(/maximum five/);
  });
});
