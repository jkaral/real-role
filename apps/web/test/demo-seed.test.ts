import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
// Read-only use of Codex's fixture generator so the seed format can't drift.
import { seedManifest } from "../../../demo/src/fixtures";
import type { Db } from "../src/db/client";
import { DemoManifestSchema, assertDemoDatabase, seedDemo } from "../src/server/demo-seed";
import { scorePosting } from "../src/server/score-service";
import { resetDb, testDb } from "./db";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const noIo = { lookupCareers: async () => null, getRubric: async () => null };

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());

describe("db:seed-demo", () => {
  it("accepts the demo manifest and is idempotent", async () => {
    const manifest = DemoManifestSchema.parse(JSON.parse(JSON.stringify(seedManifest(NOW))));
    const first = await seedDemo(db, manifest);
    const second = await seedDemo(db, manifest);
    expect(first).toEqual({ postings: 3, observations: 7 });
    expect(second.observations).toBe(0);
  });

  it("produces the expected bands end to end through the API service", async () => {
    const manifest = DemoManifestSchema.parse(JSON.parse(JSON.stringify(seedManifest(NOW))));
    await seedDemo(db, manifest);
    for (const fixture of manifest.fixtures) {
      const res = await scorePosting(db, fixture.posting, NOW, noIo);
      expect(res.result.band, fixture.slug).toBe(fixture.expectedBand);
    }
  });

  it("rejects a manifest whose fingerprints disagree with the shared helpers", async () => {
    const manifest = DemoManifestSchema.parse(JSON.parse(JSON.stringify(seedManifest(NOW))));
    manifest.fixtures[0]!.fingerprint = "fp1_0000000000000000";
    await expect(seedDemo(db, manifest)).rejects.toThrow(/fingerprint/);
  });

  it("refuses anything that might be production", () => {
    expect(() => assertDemoDatabase({})).toThrow(/ALLOW_DEMO_SEED/);
    expect(() => assertDemoDatabase({ ALLOW_DEMO_SEED: "1", VERCEL_ENV: "production" })).toThrow();
    expect(() =>
      assertDemoDatabase({
        ALLOW_DEMO_SEED: "1",
        DATABASE_URL: "postgres://u:p@ep-prod.neon.example/db",
        PRODUCTION_DATABASE_HOST: "ep-prod",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoDatabase({
        ALLOW_DEMO_SEED: "1",
        DATABASE_URL: "postgres://u:p@ep-demo.neon.example/db",
      }),
    ).not.toThrow();
  });
});
