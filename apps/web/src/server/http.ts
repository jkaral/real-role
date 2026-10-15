import { RATE_LIMIT_HEADERS, type ApiError, type ApiErrorCode } from "@real-role/shared";
import type { z } from "zod";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  unparseable_posting: 422,
  upstream_unavailable: 502,
  internal: 500,
};

export class HttpError extends Error {
  /** Set on 429s so the response still carries rate-limit headers. */
  rate?: RateLimitInfo;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  /** Epoch seconds when the window resets. */
  reset: number;
}

/** chrome-extension:// origins allowed to call the API (from EXTENSION_ORIGINS). */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (process.env.EXTENSION_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function rateHeaders(rate?: RateLimitInfo): Record<string, string> {
  if (!rate) return {};
  return {
    [RATE_LIMIT_HEADERS.limit]: String(rate.limit),
    [RATE_LIMIT_HEADERS.remaining]: String(Math.max(0, rate.remaining)),
    [RATE_LIMIT_HEADERS.reset]: String(rate.reset),
  };
}

export function json<T>(
  request: Request,
  body: T,
  init: { status?: number; rate?: RateLimitInfo } = {},
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...corsHeaders(request), ...rateHeaders(init.rate), "Cache-Control": "no-store" },
  });
}

export function errorResponse(request: Request, error: unknown, rate?: RateLimitInfo): Response {
  if (error instanceof HttpError) {
    rate = error.rate ?? rate;
    const body: ApiError = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    return json(request, body, { status: STATUS[error.code], rate });
  }
  console.error("Unhandled API error", error);
  const body: ApiError = { error: { code: "internal", message: "Something went wrong." } };
  return json(request, body, { status: 500, rate });
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/** Parse a JSON body against a zod schema, or throw a 400 with the issues. */
export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError("bad_request", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError("bad_request", "Request body is invalid.", parsed.error.issues);
  }
  return parsed.data;
}

/** Client IP for rate limiting. Vercel sets x-real-ip itself, so prefer it over x-forwarded-for. */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense in depth (the session cookie is also SameSite=Lax): state-changing requests must
 * come from this site or a browser extension. Requests without an Origin header (curl, servers)
 * carry no ambient browser cookies, so they're allowed.
 */
export function assertTrustedOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin.startsWith("chrome-extension://")) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError("forbidden", "Cross-site request blocked.");
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || originHost !== host) {
    throw new HttpError("forbidden", "Cross-site request blocked.");
  }
}
