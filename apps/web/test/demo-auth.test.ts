import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { schema } from "../src/db/client";
import { DEMO_USER_ID, createDemoSession, demoAuthAllowed } from "../src/server/demo-auth";
import { testDb } from "./db";

describe("demo sign-in guard", () => {
  it("only allows localhost with ALLOW_DEMO_AUTH=1 outside production", () => {
    const on = { ALLOW_DEMO_AUTH: "1" };
    expect(demoAuthAllowed(on, "localhost:3100")).toBe(true);
    expect(demoAuthAllowed(on, "127.0.0.1:3000")).toBe(true);
    expect(demoAuthAllowed(on, "real-role.vercel.app")).toBe(false);
    expect(demoAuthAllowed({}, "localhost:3100")).toBe(false);
    expect(demoAuthAllowed({ ...on, VERCEL_ENV: "production" }, "localhost")).toBe(false);
    expect(demoAuthAllowed(on, null)).toBe(false);
  });
});

describe("createDemoSession", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(async () => ({ db, close } = await testDb()));
  afterAll(async () => close());

  it("creates the fictional user once and a fresh session each time", async () => {
    const now = new Date("2026-10-15T12:00:00Z");
    const a = await createDemoSession(db, now);
    const b = await createDemoSession(db, now);
    expect(a.token).not.toBe(b.token);
    expect(a.expires.toISOString()).toBe("2026-10-16T12:00:00.000Z");
    const users = await db.select().from(schema.users).where(eq(schema.users.id, DEMO_USER_ID));
    expect(users).toHaveLength(1);
    expect(users[0]?.email).toBeNull();
  });
});
