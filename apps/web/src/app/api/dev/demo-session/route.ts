import { getDb } from "@/db/client";
import { createDemoSession, demoAuthAllowed } from "@/server/demo-auth";

/**
 * POST /api/dev/demo-session: sign in as the fictional demo user on a LOCAL web app.
 * Used by the end-to-end test and the demo recording (DEMO_STORAGE_STATE). 404 everywhere else.
 */
export async function POST(request: Request): Promise<Response> {
  if (!demoAuthAllowed(process.env, request.headers.get("host"))) {
    return new Response("Not found", { status: 404 });
  }
  const { token, expires } = await createDemoSession(getDb(), new Date());
  // Auth.js's cookie name on plain http (localhost).
  const cookie = `authjs.session-token=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
  return Response.json(
    { ok: true, expires: expires.toISOString() },
    { headers: { "Set-Cookie": cookie } },
  );
}
