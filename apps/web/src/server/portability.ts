import { CreateApplicationRequestSchema, PASTED_TEXT_URL } from "@real-role/shared";
import { z } from "zod";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";
import { ImportRowSchema, importIdentity, previewImport } from "@/lib/portability";
import { createApplication, listApplications } from "./applications";

export const ImportRequestSchema = z.object({ rows: z.array(ImportRowSchema).min(1).max(50) });
export async function importApplications(
  db: Db,
  userId: string,
  input: z.infer<typeof ImportRequestSchema>,
  now: Date,
) {
  const { rows } = ImportRequestSchema.parse(input);
  const preview = previewImport(rows, await listApplications(db, userId));
  let imported = 0,
    duplicates = 0;
  for (const item of preview) {
    if (item.duplicate) {
      duplicates++;
      continue;
    }
    const row = item.row;
    // A deterministic import reference keeps numeric listing IDs distinct after fingerprint normalization.
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(importIdentity(row))),
    );
    const reference = [...digest]
      .map((b) => String.fromCharCode(97 + (b >> 4), 97 + (b & 15)))
      .join("");
    const result = await createApplication(
      db,
      userId,
      CreateApplicationRequestSchema.parse({
        posting: {
          title: row.title,
          company: row.company,
          location: row.facts.location,
          descriptionText: `Imported application reference ${reference}`,
          sourceUrl: row.url || PASTED_TEXT_URL,
          source: row.url ? "generic" : "pasted_text",
          parsedBy: "csv-import",
        },
        status: row.status,
        appliedAt: row.appliedAt,
        followUpAt: row.followUpAt,
        notes: row.notes,
      }),
      now,
    );
    await db
      .insert(schema.trackedJobFacts)
      .values({ applicationId: result.application.id, values: row.facts, updatedAt: now })
      .onConflictDoNothing();
    if (result.created) imported++;
    else duplicates++;
  }
  return { imported, duplicates };
}
