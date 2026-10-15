import {
  CreateApplicationRequestSchema,
  type ApplicationResponse,
  type ListApplicationsResponse,
} from "@real-role/shared";
import { createApplication, listApplications } from "@/server/applications";
import { preflight, readBody } from "@/server/http";
import { handle, requireUserId } from "@/server/route";

export const OPTIONS = preflight;

export function GET(request: Request) {
  return handle<ListApplicationsResponse>(request, "applications", async ({ db }) => {
    const userId = await requireUserId();
    return { body: { applications: await listApplications(db, userId) } };
  });
}

export function POST(request: Request) {
  return handle<ApplicationResponse>(request, "applications", async ({ db, now }) => {
    const userId = await requireUserId();
    const input = await readBody(request, CreateApplicationRequestSchema);
    const { application, created } = await createApplication(db, userId, input, now);
    return { body: { application }, status: created ? 201 : 200 };
  });
}
