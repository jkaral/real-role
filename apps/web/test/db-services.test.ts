import type { ParsedPosting } from "@real-role/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from "../src/server/applications";
import { HttpError } from "../src/server/http";
import { getSightings, observe, recordObservation, upsertPosting } from "../src/server/postings";
import { LIMITS, rateLimit } from "../src/server/rate-limit";
import { scorePosting } from "../src/server/score-service";
import { createUser, resetDb, testDb } from "./db";

// Fictional employers only (A2).
const NOW = new Date("2026-10-15T12:00:00.000Z");
const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  location: "Toronto, ON",
  postedAt: "2026-10-13T12:00:00.000Z",
  descriptionText: "Own deployment pipelines for the Platform team. Salary CAD 110,000–140,000.",
  sourceUrl: "http://127.0.0.1:4173/jobs/fresh",
  source: "generic",
  parsedBy: "generic-jsonld",
};
const noIo = { lookupCareers: async () => null, getRubric: async () => null };

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());

describe("postings and observations", () => {
  it("upserts by fingerprint and keeps one sighting per URL per day", async () => {
    const a = await upsertPosting(db, posting, NOW);
    const b = await upsertPosting(db, posting, new Date(NOW.getTime() + 1000));
    expect(b.id).toBe(a.id);
    await recordObservation(db, a, posting.sourceUrl, NOW);
    await recordObservation(db, a, posting.sourceUrl, new Date(NOW.getTime() + 3600_000));
    await recordObservation(db, a, "http://127.0.0.1:4173/jobs/fresh-copy", NOW);
    expect((await getSightings(db, a.roleKey))?.count).toBe(2);
  });

  it("never records pasted text as a sighting", async () => {
    const row = await upsertPosting(db, { ...posting, sourceUrl: "about:pasted-text" }, NOW);
    await recordObservation(db, row, "about:pasted-text", NOW);
    expect(await getSightings(db, row.roleKey)).toBeNull();
  });

  it("observe() reports the span", async () => {
    await observe(db, posting, new Date("2026-08-16T12:00:00Z"));
    const res = await observe(db, posting, NOW);
    expect(res).toMatchObject({ sightings: 2, firstSeenAt: "2026-08-16T12:00:00.000Z" });
  });
});

describe("scorePosting", () => {
  it("scores, records the sighting and remembers the last score", async () => {
    const res = await scorePosting(db, posting, NOW, noIo);
    expect(res.result.band).toBe("high");
    expect(res.result.signals.find((s) => s.id === "repost_history")?.detail).toBe(
      "First seen today",
    );
    const user = await createUser(db);
    const { application } = await createApplication(
      db,
      user,
      { postingId: res.postingId, status: "saved" },
      NOW,
    );
    expect(application.scoreAtSave).toBe(res.result.score);
  });

  it("lowers the score when the role has been seen for months", async () => {
    const fresh = await scorePosting(db, posting, NOW, noIo);
    const { db: db2, close: close2 } = await testDb();
    try {
      for (const days of [60, 45, 30, 15]) {
        await observe(
          db2,
          { ...posting, sourceUrl: `http://127.0.0.1:4173/jobs/${days}` },
          new Date(NOW.getTime() - days * 86_400_000),
        );
      }
      const stale = await scorePosting(db2, posting, NOW, noIo);
      expect(stale.result.score).toBeLessThan(fresh.result.score);
      expect(stale.result.signals.find((s) => s.id === "repost_history")?.detail).toBe(
        "Seen 5 times over 60 days",
      );
    } finally {
      await close2();
    }
  });

  it("skips repost history when the employer is unknown", async () => {
    const res = await scorePosting(
      db,
      {
        ...posting,
        company: "Unknown employer",
        sourceUrl: "about:pasted-text",
        source: "pasted_text",
      },
      NOW,
      noIo,
    );
    expect(res.result.signals.find((s) => s.id === "repost_history")?.available).toBe(false);
  });
});

describe("applications", () => {
  it("creates once per user and posting, and lists newest first", async () => {
    const user = await createUser(db);
    const first = await createApplication(db, user, { posting, status: "saved" }, NOW);
    const again = await createApplication(db, user, { posting, status: "saved" }, NOW);
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.application.id).toBe(first.application.id);
    expect(await listApplications(db, user)).toHaveLength(1);
  });

  it("starts the follow-up clock when marked applied", async () => {
    const user = await createUser(db);
    const { application } = await createApplication(db, user, { posting, status: "saved" }, NOW);
    const updated = await updateApplication(db, user, application.id, { status: "applied" }, NOW);
    expect(updated.appliedAt).toBe(NOW.toISOString());
    expect(updated.followUpAt).toBe("2026-10-22T12:00:00.000Z");
    expect(updated.statusChangedAt).toBe(NOW.toISOString());
  });

  it("keeps an explicit follow-up date when created as applied", async () => {
    const user = await createUser(db);
    const followUpAt = "2026-11-02T09:00:00.000Z";
    const { application } = await createApplication(
      db,
      user,
      { posting, status: "applied", followUpAt },
      NOW,
    );
    expect(application.appliedAt).toBe(NOW.toISOString());
    expect(application.followUpAt).toBe(followUpAt);
  });

  it("keeps users' applications private", async () => {
    const alice = await createUser(db, "Alice");
    const bob = await createUser(db, "Bob");
    const { application } = await createApplication(db, alice, { posting, status: "saved" }, NOW);
    expect(await listApplications(db, bob)).toEqual([]);
    await expect(
      updateApplication(db, bob, application.id, { notes: "x" }, NOW),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(deleteApplication(db, bob, application.id)).rejects.toBeInstanceOf(HttpError);
    await deleteApplication(db, alice, application.id);
    expect(await listApplications(db, alice)).toEqual([]);
  });

  it("404s for an unknown posting id", async () => {
    const user = await createUser(db);
    await expect(
      createApplication(db, user, { postingId: "nope", status: "saved" }, NOW),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per window, then 429s with headers", async () => {
    const { limit } = LIMITS.scoreUrl;
    for (let i = 0; i < limit; i++) await rateLimit(db, "scoreUrl", "1.2.3.4", NOW.getTime());
    const err = await rateLimit(db, "scoreUrl", "1.2.3.4", NOW.getTime()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("rate_limited");
    expect((err as HttpError).rate?.remaining).toBeLessThanOrEqual(0);
    // Another client and the next window are unaffected.
    await expect(rateLimit(db, "scoreUrl", "5.6.7.8", NOW.getTime())).resolves.toBeDefined();
    await expect(
      rateLimit(db, "scoreUrl", "1.2.3.4", NOW.getTime() + 61_000),
    ).resolves.toBeDefined();
  });
});
