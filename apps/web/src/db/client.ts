import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import type { PGlite as PGliteClass } from "@electric-sql/pglite";
import type { drizzle as drizzlePgliteFn } from "drizzle-orm/pglite";
import { createRequire } from "node:module";
import * as schema from "./schema";

/** Any Postgres Drizzle database with our schema (Neon in the app, PGlite locally and in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** `pglite:<dir>` runs an in-process Postgres for local dev, the e2e test and the demo. */
export const PGLITE_PREFIX = "pglite:";

let cached: Db | undefined;

const globalForDb = globalThis as typeof globalThis & { __realRolePglite?: Db };

function pgliteDb(dir: string): Db {
  // Next bundles this module separately for pages and route handlers; two PGlite instances on one
  // directory don't see each other's writes, so share one per process.
  if (globalForDb.__realRolePglite) return globalForDb.__realRolePglite;
  // Loaded lazily so production bundles never include PGlite.
  const require = createRequire(import.meta.url);
  const { PGlite } = require("@electric-sql/pglite") as { PGlite: typeof PGliteClass };
  const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as {
    drizzle: typeof drizzlePgliteFn;
  };
  globalForDb.__realRolePglite = drizzlePglite(new PGlite(dir), { schema }) as unknown as Db;
  return globalForDb.__realRolePglite;
}

export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith(PGLITE_PREFIX)) {
    if (process.env.VERCEL_ENV === "production") throw new Error("PGlite is for local use only");
    cached = pgliteDb(url.slice(PGLITE_PREFIX.length));
  } else {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export { schema };
