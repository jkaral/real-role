import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "../src/db/client";
import { schema } from "../src/db/client";
import {
  createApplication,
  deleteApplication,
  updateApplication,
} from "../src/server/applications";
import { CreateApplicationRequestSchema } from "@real-role/shared";
import { readInsights } from "../src/server/insights";
import { createUser, resetDb, testDb } from "./db";
let db: Db, close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());
const now = new Date("2026-10-15T12:00:00Z");
describe("atomic account-private status events", () => {
  it("records inserts and real transitions but not notes or repeated statuses", async () => {
    const user = await createUser(db),
      other = await createUser(db, "Other User");
    const result = await createApplication(
      db,
      user,
      CreateApplicationRequestSchema.parse({
        posting: {
          title: "Platform Engineer",
          company: "Bramblecrest Analytics",
          sourceUrl: "about:pasted-text",
          source: "pasted_text",
          parsedBy: "test",
          descriptionText: "",
        },
      }),
      now,
    );
    await updateApplication(
      db,
      user,
      result.application.id,
      { status: "applied" },
      new Date(now.getTime() + 1000),
    );
    await updateApplication(
      db,
      user,
      result.application.id,
      { status: "applied", notes: "Never include this in events" },
      new Date(now.getTime() + 2000),
    );
    await updateApplication(
      db,
      user,
      result.application.id,
      { status: "interviewing" },
      new Date(now.getTime() + 3000),
    );
    const data = await readInsights(db, user);
    expect(data.events.map((e) => e.toStatus)).toEqual(["interviewing", "applied", "saved"]);
    expect(data.events.every((e) => !e.baseline)).toBe(true);
    expect(JSON.stringify(data.events)).not.toContain("Never include");
    expect((await readInsights(db, other)).events).toEqual([]);
    await deleteApplication(db, user, result.application.id);
    expect(await db.select().from(schema.applicationStageEvents)).toEqual([]);
  });
  it("cascades history when an account is deleted", async () => {
    const user = await createUser(db);
    await createApplication(
      db,
      user,
      CreateApplicationRequestSchema.parse({
        posting: {
          title: "Analyst",
          company: "Northwind Lumen",
          sourceUrl: "about:pasted-text",
          source: "pasted_text",
          parsedBy: "test",
          descriptionText: "",
        },
      }),
      now,
    );
    await db.delete(schema.users).where(eq(schema.users.id, user));
    expect(await db.select().from(schema.applicationStageEvents)).toEqual([]);
  });
});
