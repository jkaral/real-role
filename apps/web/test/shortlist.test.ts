import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../src/db/client";
import { assessFit, DEFAULT_PREFERENCES, factsFromPosting } from "../src/lib/job-preferences";
import {
  clearPreferences,
  findSavedPosting,
  readShortlist,
  saveToShortlist,
  writePreferences,
} from "../src/server/shortlist";
import { deleteApplication, updateApplication } from "../src/server/applications";
import { upsertPosting } from "../src/server/postings";
import { createUser, resetDb, testDb } from "./db";

let db: Db, close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());
const now = new Date("2026-10-15T12:00:00Z");
const posting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  sourceUrl: "https://bramblecrest.example/jobs/42",
  source: "generic" as const,
  parsedBy: "test",
  descriptionText: "Requires at least 3 years of experience.",
  location: "Toronto",
  salary: { min: 100000, max: 130000, currency: "CAD", period: "year" as const },
};

describe("synced shortlist and privacy", () => {
  it("finds a prior save by exact URL/employer/title when its content fingerprint changes", async () => {
    const user = await createUser(db),
      first = await upsertPosting(db, posting, now);
    const saved = await saveToShortlist(
      db,
      user,
      { postingId: first.id, facts: { location: "Toronto" } },
      now,
    );
    const changed = await upsertPosting(
      db,
      { ...posting, descriptionText: "A changed description of this same role." },
      now,
    );
    expect(changed.id).not.toBe(first.id);
    expect((await findSavedPosting(db, user, changed.id))?.id).toBe(saved.application.id);
    expect(
      (
        await saveToShortlist(
          db,
          user,
          { postingId: changed.id, facts: { location: "Vancouver" } },
          now,
        )
      ).created,
    ).toBe(false);
    const different = await upsertPosting(
      db,
      { ...posting, title: "Finance Director", descriptionText: "A different role reusing a URL." },
      now,
    );
    expect(await findSavedPosting(db, user, different.id)).toBeNull();
  });
  it("migrates, scopes facts/preferences to their owner and keeps old tracking compatible", async () => {
    const owner = await createUser(db),
      other = await createUser(db, "Other User");
    const row = await upsertPosting(db, posting, now);
    const saved = await saveToShortlist(
      db,
      owner,
      { postingId: row.id, facts: factsFromPosting(posting) },
      now,
    );
    await writePreferences(db, owner, { ...DEFAULT_PREFERENCES, location: "Toronto" });
    const list = await readShortlist(db, owner);
    expect(list.facts[saved.application.id]?.salary?.currency).toBe("CAD");
    expect(list.preferences.location).toBe("Toronto");
    expect((await readShortlist(db, other)).applications).toEqual([]);
    expect((await readShortlist(db, other)).facts).toEqual({});
    expect((await readShortlist(db, other)).preferences.location).toBe("");
    expect(await findSavedPosting(db, other, row.id)).toBeNull();
    expect((await findSavedPosting(db, owner, row.id))?.id).toBe(saved.application.id);
  });
  it("keeps the prior application/status/notes and captured facts on duplicate saves", async () => {
    const user = await createUser(db),
      row = await upsertPosting(db, posting, now);
    const first = await saveToShortlist(
      db,
      user,
      { postingId: row.id, facts: { location: "Toronto" } },
      now,
    );
    await updateApplication(
      db,
      user,
      first.application.id,
      { status: "applied", notes: "Private notes" },
      now,
    );
    const again = await saveToShortlist(
      db,
      user,
      { postingId: row.id, facts: { location: "Vancouver" } },
      now,
    );
    expect(again.created).toBe(false);
    expect(again.application.status).toBe("applied");
    expect(again.application.notes).toBe("Private notes");
    expect((await readShortlist(db, user)).facts[first.application.id]?.location).toBe("Toronto");
  });
  it("clears preferences and cascades facts on application/account deletion", async () => {
    const user = await createUser(db),
      row = await upsertPosting(db, posting, now);
    const saved = await saveToShortlist(
      db,
      user,
      { postingId: row.id, facts: { remote: true } },
      now,
    );
    await writePreferences(db, user, { ...DEFAULT_PREFERENCES, remote: "remote" });
    await clearPreferences(db, user);
    expect((await readShortlist(db, user)).preferences.remote).toBe("any");
    await deleteApplication(db, user, saved.application.id);
    expect(await db.select().from(schema.trackedJobFacts)).toEqual([]);
    await writePreferences(db, user, { ...DEFAULT_PREFERENCES, remote: "remote" });
    await db.delete(schema.users).where(eq(schema.users.id, user));
    expect(await db.select().from(schema.jobPreferences)).toEqual([]);
  });
});

describe("fit remains separate from freshness", () => {
  it("reports missing data and incomparable pay as unknown", () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      salaryMin: 100000,
      experienceYears: 3,
      remote: "remote" as const,
    };
    expect(
      assessFit(
        "Engineer",
        { salary: { max: 150000, currency: "CAD", period: "year" } },
        preferences,
      ),
    ).toEqual({ matched: [], mismatched: [], unknown: ["Workplace", "Salary", "Experience"] });
    expect(
      assessFit("Engineer", { salary: { max: 150, currency: "USD", period: "hour" } }, preferences)
        .unknown,
    ).toContain("Salary");
  });
  it("explains explicit matches and mismatches without modifying scores", () => {
    const result = assessFit(
      "Platform Engineer",
      {
        location: "Toronto",
        remote: true,
        salary: { max: 80000, currency: "USD", period: "year" },
        experienceMinYears: 5,
      },
      {
        ...DEFAULT_PREFERENCES,
        titles: "engineer,analyst",
        location: "Toronto",
        remote: "remote",
        salaryMin: 100000,
        experienceYears: 3,
      },
    );
    expect(result.matched).toEqual(["Job title", "Location", "Workplace"]);
    expect(result.mismatched).toEqual(["Salary", "Experience"]);
  });
  it("extracts minimal metadata without storing descriptions or invalid pay", () => {
    const facts = factsFromPosting({
      ...posting,
      descriptionText: "At least 3 years of experience.",
      salary: { min: 10, max: 1, currency: "CAD", period: "year" },
    });
    expect(facts.experienceMinYears).toBe(3);
    expect(facts.salary).toBeUndefined();
    expect(facts).not.toHaveProperty("descriptionText");
  });
});
