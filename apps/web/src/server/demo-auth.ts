import { randomBytes } from "node:crypto";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";

export const DEMO_USER_ID = "demo-user";
export const DEMO_SESSION_DAYS = 1;

/**
 * The demo sign-in exists only for local recordings and the e2e test: it needs ALLOW_DEMO_AUTH=1,
 * never runs on Vercel (Vercel sets VERCEL=1 for every build and function), and only answers
 * requests addressed to localhost. The Host check alone isn't enough (clients control Host).
 * VERCEL_ENV=development is allowed: the demo pipeline sets it for local runs.
 */
export function demoAuthAllowed(
  env: Record<string, string | undefined>,
  host: string | null,
): boolean {
  if (env.ALLOW_DEMO_AUTH !== "1" || env.VERCEL === "1") return false;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return false;
  const hostname = (host ?? "").replace(/:\d+$/, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** Create a database session for the fictional demo user (the same rows GitHub sign-in makes). */
export async function createDemoSession(
  db: Db,
  now: Date,
): Promise<{ token: string; expires: Date }> {
  await db
    .insert(schema.users)
    .values({ id: DEMO_USER_ID, name: "Demo User (fictional)" })
    .onConflictDoNothing();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(now.getTime() + DEMO_SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ sessionToken: token, userId: DEMO_USER_ID, expires });
  return { token, expires };
}
