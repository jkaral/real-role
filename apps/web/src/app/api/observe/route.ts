import { ObserveRequestSchema, type ObserveResponse } from "@real-role/shared";
import { preflight, readBody } from "@/server/http";
import { observe } from "@/server/postings";
import { handle } from "@/server/route";

export const OPTIONS = preflight;

export function POST(request: Request) {
  return handle<ObserveResponse>(request, "observe", async ({ db, now }) => {
    const { posting } = await readBody(request, ObserveRequestSchema);
    return { body: await observe(db, posting, now) };
  });
}
