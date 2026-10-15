import { auth } from "@/auth";
import { getDb, type Db } from "@/db/client";
import { HttpError, clientIp, errorResponse, json, type RateLimitInfo } from "./http";
import { rateLimit, type Bucket } from "./rate-limit";

interface Ctx {
  db: Db;
  rate: RateLimitInfo;
  now: Date;
}

/** Rate-limits, runs the handler, and turns errors into the contract's ApiError envelope. */
export async function handle<T>(
  request: Request,
  bucket: Bucket,
  fn: (ctx: Ctx) => Promise<{ body: T; status?: number } | Response>,
): Promise<Response> {
  let rate: RateLimitInfo | undefined;
  try {
    const db = getDb();
    rate = await rateLimit(db, bucket, clientIp(request));
    const out = await fn({ db, rate, now: new Date() });
    if (out instanceof Response) return out;
    return json(request, out.body, { status: out.status ?? 200, rate });
  } catch (error) {
    return errorResponse(request, error, rate);
  }
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError("unauthorized", "Sign in to track applications.");
  return id;
}
