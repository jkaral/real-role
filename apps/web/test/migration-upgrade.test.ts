import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { expect, it } from "vitest";
import { CreateApplicationRequestSchema } from "@real-role/shared";
import { schema, type Db } from "../src/db/client";
import { createApplication, updateApplication } from "../src/server/applications";
import { createUser } from "./db";

it("upgrades an existing tracked application with a labelled history baseline and no lost data", async () => {
  const client = new PGlite();
  try {
    for (const name of ["0000_init.sql", "0001_tranquil_gideon.sql"])
      await client.exec(await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
    const db = drizzle(client, { schema }) as unknown as Db,
      user = await createUser(db);
    const now = new Date("2026-10-15T12:00:00Z");
    const saved = await createApplication(
      db,
      user,
      CreateApplicationRequestSchema.parse({
        posting: {
          title: "Migration Test Analyst",
          company: "Bramblecrest Analytics",
          sourceUrl: "about:pasted-text",
          source: "pasted_text",
          parsedBy: "test",
          descriptionText: "",
        },
        notes: "Keep this existing note",
      }),
      now,
    );
    await client.exec(
      await readFile(new URL("../drizzle/0002_careful_masque.sql", import.meta.url), "utf8"),
    );
    await client.exec(
      await readFile(
        new URL("../drizzle/0003_steady_christian_walker.sql", import.meta.url),
        "utf8",
      ),
    );
    const baseline = await db.select().from(schema.applicationStageEvents);
    expect(baseline).toMatchObject([
      { applicationId: saved.application.id, baseline: true, fromStatus: null, toStatus: "saved" },
    ]);
    await updateApplication(
      db,
      user,
      saved.application.id,
      { status: "applied" },
      new Date(now.getTime() + 1000),
    );
    const events = await db.select().from(schema.applicationStageEvents);
    expect(events.filter((e) => !e.baseline)).toMatchObject([
      { fromStatus: "saved", toStatus: "applied" },
    ]);
    expect((await db.select().from(schema.trackedApplications))[0]?.notes).toBe(
      "Keep this existing note",
    );
  } finally {
    await client.close();
  }
});
