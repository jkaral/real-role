import { HttpError, preflight, readBody } from "@/server/http";
import { handle, requireUserId } from "@/server/route";
import {
  findSavedPosting,
  readShortlist,
  saveToShortlist,
  SaveShortlistSchema,
} from "@/server/shortlist";

export const OPTIONS = preflight;
export function GET(request: Request) {
  return handle<
    | Awaited<ReturnType<typeof readShortlist>>
    | { application: Awaited<ReturnType<typeof findSavedPosting>>; matchedPostingId: string }
  >(request, "applications", async ({ db }) => {
    const userId = await requireUserId();
    const postingId = new URL(request.url).searchParams.get("postingId");
    if (postingId !== null) {
      if (!postingId || postingId.length > 100)
        throw new HttpError("bad_request", "Invalid posting identifier.");
      return {
        body: {
          application: await findSavedPosting(db, userId, postingId),
          matchedPostingId: postingId,
        },
      };
    }
    return { body: await readShortlist(db, userId) };
  });
}
export function POST(request: Request) {
  return handle(request, "applications", async ({ db, now }) => {
    const userId = await requireUserId();
    const result = await saveToShortlist(
      db,
      userId,
      await readBody(request, SaveShortlistSchema),
      now,
    );
    return { body: { application: result.application }, status: result.created ? 201 : 200 };
  });
}
