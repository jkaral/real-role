import { randomBytes } from "node:crypto";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";

export const DEMO_USER_ID = "demo-user";
export const DEMO_SESSION_DAYS = 1;

/**
 * The demo sign-in exists only for local recordings and the e2e test: it needs ALLOW_DEMO_AUTH=1,
 * never runs on Vercel production, and only answers requests addressed to localhost.
 */
export function demoAuthAllowed(
  env: Record<string, string | undefined>,
  host: string | null,
): boolean {
  if (env.ALLOW_DEMO_AUTH !== "1" || env.VERCEL_ENV === "production") return false;
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
