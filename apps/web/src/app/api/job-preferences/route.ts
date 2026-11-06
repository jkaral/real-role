import { DEFAULT_PREFERENCES, JobPreferencesSchema } from "@/lib/job-preferences";
import { preflight, readBody } from "@/server/http";
import { handle, requireUserId } from "@/server/route";
import { clearPreferences, writePreferences } from "@/server/shortlist";

export const OPTIONS = preflight;
export function PUT(request: Request) {
  return handle(request, "applications", async ({ db }) => {
    const userId = await requireUserId();
    return {
      body: {
        preferences: await writePreferences(
          db,
          userId,
          await readBody(request, JobPreferencesSchema),
        ),
      },
    };
  });
}
export function DELETE(request: Request) {
  return handle(request, "applications", async ({ db }) => {
    await clearPreferences(db, await requireUserId());
    return { body: { preferences: DEFAULT_PREFERENCES } };
  });
}
