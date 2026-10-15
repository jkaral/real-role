import { UpdateApplicationRequestSchema, type ApplicationResponse } from "@real-role/shared";
import { deleteApplication, updateApplication } from "@/server/applications";
import { corsHeaders, preflight, readBody } from "@/server/http";
import { handle, requireUserId } from "@/server/route";

type Params = { params: Promise<{ id: string }> };

export const OPTIONS = preflight;

export function PATCH(request: Request, { params }: Params) {
  return handle<ApplicationResponse>(request, "applications", async ({ db, now }) => {
    const userId = await requireUserId();
    const { id } = await params;
    const patch = await readBody(request, UpdateApplicationRequestSchema);
    return { body: { application: await updateApplication(db, userId, id, patch, now) } };
  });
}

export function DELETE(request: Request, { params }: Params) {
  return handle<never>(request, "applications", async ({ db }) => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteApplication(db, userId, id);
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  });
}
