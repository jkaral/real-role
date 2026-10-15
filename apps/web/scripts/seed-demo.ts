// Seeds the demo's fictional postings and observations into a NON-production database.
// Usage (from the repo root): ALLOW_DEMO_SEED=1 pnpm --filter @real-role/web db:seed-demo demo/output/seed.json
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/db/client";
import { DemoManifestSchema, assertDemoDatabase, seedDemo } from "../src/server/demo-seed";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: db:seed-demo <repo-root-relative manifest path>");
  process.exit(1);
}

assertDemoDatabase(process.env);
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const path = isAbsolute(arg) ? arg : resolve(repoRoot, arg);
const manifest = DemoManifestSchema.parse(JSON.parse(await readFile(path, "utf8")));
const result = await seedDemo(getDb(), manifest);
console.log(
  `Seeded ${result.postings} fixture postings and ${result.observations} new observations.`,
);
