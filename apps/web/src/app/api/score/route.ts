import { ScoreRequestSchema, type ScoreResponse } from "@real-role/shared";
import { preflight, readBody, clientIp } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { handle } from "@/server/route";
import { resolvePosting, scorePosting } from "@/server/score-service";

export const maxDuration = 30;

export const OPTIONS = preflight;

export function POST(request: Request) {
  return handle<ScoreResponse>(request, "score", async ({ db, now }) => {
    const body = await readBody(request, ScoreRequestSchema);
    // Server-side page fetches get a tighter limit of their own.
    if (body.kind === "url") await rateLimit(db, "scoreUrl", clientIp(request));
    const posting = await resolvePosting(body, now);
    return { body: await scorePosting(db, posting, now) };
  });
}
