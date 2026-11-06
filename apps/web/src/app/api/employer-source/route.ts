import { EmployerSourceRequestSchema, findEmployerSource } from "@real-role/ats";
import { preflight, readBody } from "@/server/http";
import { handle } from "@/server/route";

export const maxDuration = 10;
export const OPTIONS = preflight;
export function POST(request: Request) {
  return handle(request, "scoreUrl", async () => {
    const input = await readBody(request, EmployerSourceRequestSchema);
    return { body: await findEmployerSource(input, { fetch, signal: AbortSignal.timeout(6000) }) };
  });
}
