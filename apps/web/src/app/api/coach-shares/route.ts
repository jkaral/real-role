import { CoachActionSchema } from "@/lib/coach-contract";
import { preflight, readBody, HttpError } from "@/server/http";
import { handle, requireUserId } from "@/server/route";
import {
  acceptCoachInvite,
  createCoachInvite,
  managedShares,
  previewCoachInvite,
  receivedCoachShares,
  revokeCoachShare,
} from "@/server/coach";
export const OPTIONS = preflight;
export function GET(request: Request) {
  return handle<unknown>(request, "applications", async ({ db }) => {
    const userId = await requireUserId(),
      applicationId = new URL(request.url).searchParams.get("applicationId");
    if (applicationId !== null) {
      if (!applicationId || applicationId.length > 100)
        throw new HttpError("bad_request", "Invalid application identifier.");
      return { body: { shares: await managedShares(db, userId, applicationId) } };
    }
    return { body: { items: await receivedCoachShares(db, userId) } };
  });
}
export function POST(request: Request) {
  return handle<unknown>(request, "applications", async ({ db, now }) => {
    const userId = await requireUserId(),
      input = await readBody(request, CoachActionSchema);
    switch (input.action) {
      case "create":
        return { body: await createCoachInvite(db, userId, input.applicationId, now), status: 201 };
      case "preview":
        return { body: await previewCoachInvite(db, userId, input.token, now) };
      case "accept":
        return { body: await acceptCoachInvite(db, userId, input.token, now) };
      case "revoke":
        await revokeCoachShare(db, userId, input.shareId, now);
        return { body: { revoked: true } };
    }
  });
}
