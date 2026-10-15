import { IsoDateTimeSchema, ParsedPostingSchema, fingerprint, roleKey } from "@real-role/shared";
import { z } from "zod";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";
import { upsertPosting } from "./postings";

/** Version-1 manifest written by `demo/` (see demo/README.md). */
export const DemoManifestSchema = z.object({
  version: z.literal(1),
  generatedAt: IsoDateTimeSchema,
  fixtures: z.array(
    z.object({
      slug: z.string().min(1),
      expectedBand: z.enum(["high", "medium", "low"]),
      posting: ParsedPostingSchema,
      fingerprint: z.string(),
      roleKey: z.string(),
      observations: z.array(
        z.object({ sourceUrl: z.string().min(1), observedAt: IsoDateTimeSchema }),
      ),
    }),
  ),
});
export type DemoManifest = z.infer<typeof DemoManifestSchema>;

/**
 * Refuse anything that might be production. Seeding needs ALLOW_DEMO_SEED=1, never runs on a
 * Vercel production deployment, and refuses the host named in PRODUCTION_DATABASE_HOST.
 */
export function assertDemoDatabase(env: Record<string, string | undefined>): void {
  if (env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed: set ALLOW_DEMO_SEED=1 for a demo or local database.");
  }
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production environment.");
  }
  const url = env.DATABASE_URL ?? "";
  const prodHost = env.PRODUCTION_DATABASE_HOST;
  if (prodHost && url.includes(prodHost)) {
    throw new Error("Refusing to seed: DATABASE_URL points at the production database host.");
  }
}

/** Upsert fixture postings and their observations. Safe to run repeatedly. */
export async function seedDemo(
  db: Db,
  manifest: DemoManifest,
): Promise<{ postings: number; observations: number }> {
  let observations = 0;
  for (const fixture of manifest.fixtures) {
    // The manifest must agree with the shared helpers, or repost history won't line up.
    if (
      fingerprint(fixture.posting) !== fixture.fingerprint ||
      roleKey(fixture.posting) !== fixture.roleKey
    ) {
      throw new Error(
        `Fixture "${fixture.slug}" has a fingerprint/roleKey that doesn't match @real-role/shared.`,
      );
    }
    const first = fixture.observations
      .map((o) => new Date(o.observedAt))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const row = await upsertPosting(db, fixture.posting, first ?? new Date(manifest.generatedAt));
    for (const o of fixture.observations) {
      const inserted = await db
        .insert(schema.observations)
        .values({
          roleKey: row.roleKey,
          postingId: row.id,
          sourceUrl: o.sourceUrl,
          observedDay: o.observedAt.slice(0, 10),
          observedAt: new Date(o.observedAt),
        })
        .onConflictDoNothing()
        .returning({ id: schema.observations.id });
      observations += inserted.length;
    }
  }
  return { postings: manifest.fixtures.length, observations };
}
