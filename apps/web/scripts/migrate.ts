// Applies drizzle/ migrations to DATABASE_URL. Run: pnpm --filter @real-role/web db:migrate
// With --production-only (used by the Vercel build), it runs only for production deployments,
// so preview builds never touch the production database.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--production-only") && process.env.VERCEL_ENV !== "production") {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

await migrate(drizzle(neon(url)), {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});
console.log("Migrations applied.");
