import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";

/** A fresh in-memory Postgres with the real migrations applied. */
export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  return { db: db as unknown as Db, close: () => client.close() };
}

/** Empty every table between tests (much faster than a fresh database each time). */
export async function resetDb(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE users, accounts, sessions, "verificationTokens", postings, observations, tracked_applications, rubric_cache, rate_limits CASCADE`,
  );
}

export async function createUser(db: Db, name = "Test User"): Promise<string> {
  const [row] = await db.insert(schema.users).values({ name }).returning({ id: schema.users.id });
  if (!row) throw new Error("user insert failed");
  return row.id;
}
