import {
  API_ROUTES,
  ApiErrorSchema,
  ApplicationResponseSchema,
  ListApplicationsResponseSchema,
  ScoreResponseSchema,
  type ParsedPosting,
  type ScoreResponse,
  type TrackedApplication,
} from "@real-role/shared";
import { API_BASE } from "./config";

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

const REQUEST_TIMEOUT_MS = 15_000;

/** Keep the deadline active through response-body consumption, including error replies. */
async function request<T>(
  path: string,
  init: RequestInit,
  read: (res: Response) => Promise<T>,
  fetchImpl: typeof fetch,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiFailure(
          0,
          "timeout",
          "Real Role took too long to respond. Try again. If you were saving, check your dashboard first.",
        ),
      );
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      fetchImpl(`${API_BASE}${path}`, {
        ...init,
        credentials: "include",
        signal: controller.signal,
      }).then(read),
      deadline,
    ]);
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure(0, "network", "Couldn't read Real Role's response. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function scorePosting(
  posting: ParsedPosting,
  fetchImpl: typeof fetch = fetch,
): Promise<ScoreResponse> {
  return request(
    API_ROUTES.score,
    post({ kind: "parsed", posting }),
    async (res) => {
      if (!res.ok) throw await failure(res);
      return ScoreResponseSchema.parse(await res.json());
    },
    fetchImpl,
  );
}

export type SaveResult =
  { status: "saved"; application: TrackedApplication } | { status: "signin" };

export async function saveApplication(
  postingId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SaveResult> {
  return request(
    API_ROUTES.applications,
    post({ postingId }),
    async (res): Promise<SaveResult> => {
      if (res.status === 401) return { status: "signin" };
      if (!res.ok) throw await failure(res);
      return {
        status: "saved",
        application: ApplicationResponseSchema.parse(await res.json()).application,
      };
    },
    fetchImpl,
  );
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
    return await request(
      API_ROUTES.applications,
      {},
      async (res) => {
        if (!res.ok) return null;
        const { applications } = ListApplicationsResponseSchema.parse(await res.json());
        return applications.find((a) => a.postingId === postingId) ?? null;
      },
      fetchImpl,
    );
  } catch {
    return null;
  }
}

export const signInUrl = () => `${API_BASE}/signin?callbackUrl=/dashboard`;
export const dashboardUrl = () => `${API_BASE}/dashboard`;
export const pasteTextUrl = () => `${API_BASE}/check?mode=text`;
