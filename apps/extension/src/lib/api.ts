import {
  API_ROUTES,
  ApiErrorSchema,
  ApplicationResponseSchema,
  ScoreResponseSchema,
  type ParsedPosting,
  type ScoreResponse,
  type TrackedApplication,
} from "@real-role/shared";
import { API_BASE } from "./config";
import { extractExperienceMinimum } from "@real-role/parsers";
import { z } from "zod";

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function failure(res: Response): Promise<ApiFailure> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  return parsed.success
    ? new ApiFailure(res.status, parsed.data.error.code, parsed.data.error.message)
    : new ApiFailure(res.status, "internal", "Real Role is unavailable right now.");
}

async function post(path: string, body: unknown, fetchImpl: typeof fetch): Promise<Response> {
  try {
    // Cookies (the web app session) are sent because the extension has host permission.
    return await fetchImpl(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, "network", "Couldn't reach Real Role. Check your connection.");
  }
}

export async function scorePosting(
  posting: ParsedPosting,
  fetchImpl: typeof fetch = fetch,
): Promise<ScoreResponse> {
  const res = await post(API_ROUTES.score, { kind: "parsed", posting }, fetchImpl);
  if (!res.ok) throw await failure(res);
  return ScoreResponseSchema.parse(await res.json());
}

export type SaveResult =
  { status: "saved"; application: TrackedApplication } | { status: "signin" };

export async function saveApplication(
  postingId: string,
  fetchImpl: typeof fetch = fetch,
  posting?: ParsedPosting,
): Promise<SaveResult> {
  const res = await post(
    posting ? "/api/shortlist" : API_ROUTES.applications,
    posting
      ? {
          postingId,
          facts: {
            location: posting.location,
            remote: posting.remote,
            employmentType: posting.employmentType,
            salary:
              posting.salary?.min !== undefined &&
              posting.salary.max !== undefined &&
              posting.salary.min > posting.salary.max
                ? undefined
                : posting.salary,
            experienceMinYears: extractExperienceMinimum(posting.descriptionText),
          },
        }
      : { postingId },
    fetchImpl,
  );
  if (res.status === 401) return { status: "signin" };
  if (!res.ok) throw await failure(res);
  return {
    status: "saved",
    application: ApplicationResponseSchema.parse(await res.json()).application,
  };
}

/**
 * The signed-in user's tracked application for this posting, if any. Signed out or offline
 * counts as "not tracked": the panel then simply offers Save & track.
 */
export async function findTracked(
  postingId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TrackedApplication | null> {
  try {
    const res = await fetchImpl(
      `${API_BASE}/api/shortlist?postingId=${encodeURIComponent(postingId)}`,
      {
        credentials: "include",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return null;
    const parsed = ApplicationResponseSchema.extend({
      matchedPostingId: z.string().optional(),
    }).safeParse(await res.json());
    return parsed.success &&
      (parsed.data.application.postingId === postingId ||
        parsed.data.matchedPostingId === postingId)
      ? parsed.data.application
      : null;
  } catch {
    return null;
  }
}

export const signInUrl = () => `${API_BASE}/signin?callbackUrl=/dashboard`;
export const dashboardUrl = () => `${API_BASE}/dashboard`;
export const pasteTextUrl = () => `${API_BASE}/check?mode=text`;
