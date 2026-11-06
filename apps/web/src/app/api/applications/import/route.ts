import { preflight, readBody } from "@/server/http";
import { handle, requireUserId } from "@/server/route";
import { importApplications, ImportRequestSchema } from "@/server/portability";
export const maxDuration = 30;
export const OPTIONS = preflight;
export function POST(request: Request) {
  return handle(request, "applications", async ({ db, now }) => {
    const userId = await requireUserId();
    return {
      body: await importApplications(db, userId, await readBody(request, ImportRequestSchema), now),
    };
  });
}
