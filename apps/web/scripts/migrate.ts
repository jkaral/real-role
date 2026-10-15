// Applies drizzle/ migrations to DATABASE_URL. Run: pnpm --filter @real-role/web db:migrate
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

await migrate(drizzle(neon(url)), {
  migrationsFolder: new URL("../drizzle", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});
console.log("Migrations applied.");
