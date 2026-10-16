import { z } from "zod";
import {
  AtsBoardSchema,
  AtsRoleSchema,
  normalizeText,
  normalizeTitle,
  type AtsAdapter,
  type AtsBoard,
  type AtsContext,
  type AtsRole,
  type MatchResult,
  type ParsedPosting,
} from "@real-role/shared";

const tokenPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const definitions = {
  greenhouse: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
  lever: ["jobs.lever.co", "jobs.eu.lever.co"],
  ashby: ["jobs.ashbyhq.com"],
} as const;
type Provider = keyof typeof definitions;

/** Resolve only hosted official board URLs, without making an HTTP request. */
export function identifyBoard(input: string): AtsBoard | null {
  for (const provider of Object.keys(definitions) as Provider[]) {
    const board = boardFromUrl(input, provider);
    if (board) return board;
  }
  return null;
}

/** A successful empty board must remain distinguishable from a failed request. */
export async function readOfficialBoard(input: string, ctx?: AtsContext) {
  const board = identifyBoard(input);
  if (!board) return { status: "unsupported" as const };
  try {
    const roles = await load(board, ctx);
    return roles === null
      ? { status: "unavailable" as const, board }
      : { status: "available" as const, board, roles };
  } catch {
    return { status: "unavailable" as const, board };
  }
}

function boardFromUrl(input: string, provider: Provider): AtsBoard | null {
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!(definitions[provider] as readonly string[]).includes(url.hostname)) return null;
    const token = url.pathname.split("/")[1];
    if (!token || !tokenPattern.test(token)) return null;
    return { provider, boardToken: token, boardUrl: `https://${url.hostname}/${token}` };
  } catch {
    return null;
  }
}

async function getJson(url: string, ctx?: AtsContext): Promise<unknown> {
  const timeout = AbortSignal.timeout(5000);
  const signal = ctx?.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;
  const response = await (ctx?.fetch ?? fetch)(url, {
    signal,
    redirect: "error",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`ATS unavailable (${response.status})`);
  return response.json();
}

const ghJob = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  absolute_url: z.string().url(),
  location: z.object({ name: z.string() }).nullish(),
  updated_at: z.string().optional(),
  departments: z.array(z.object({ name: z.string() })).optional(),
});
const leverJob = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string().url(),
  categories: z
    .object({ location: z.string().optional(), department: z.string().optional() })
    .optional(),
});
const ashbyJob = z.object({
  id: z.string().optional(),
  title: z.string(),
  jobUrl: z.string().url(),
  location: z.string().optional(),
  department: z.string().optional(),
  publishedAt: z.string().optional(),
  isListed: z.boolean().optional(),
});
const date = (value: string | undefined): string | undefined =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;

async function load(board: AtsBoard, ctx?: AtsContext): Promise<AtsRole[] | null> {
  if (!AtsBoardSchema.safeParse(board).success || !tokenPattern.test(board.boardToken)) return null;
  const token = encodeURIComponent(board.boardToken);
  let roles: unknown[];
  if (board.provider === "greenhouse") {
    const data = z
      .object({ jobs: z.array(ghJob) })
      .parse(
        await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, ctx),
      );
    roles = data.jobs.map((job) => ({
      provider: board.provider,
      id: String(job.id),
      title: job.title,
      location: job.location?.name,
      url: job.absolute_url,
      updatedAt: date(job.updated_at),
      department: job.departments?.[0]?.name,
    }));
  } else if (board.provider === "lever") {
    const host =
      new URL(board.boardUrl).hostname === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    const data = z
      .array(leverJob)
      .parse(await getJson(`https://${host}/v0/postings/${token}?mode=json`, ctx));
    roles = data.map((job) => ({
      provider: board.provider,
      id: job.id,
      title: job.text,
      location: job.categories?.location,
      department: job.categories?.department,
      url: job.hostedUrl,
    }));
  } else if (board.provider === "ashby") {
    const data = z
      .object({ jobs: z.array(ashbyJob) })
      .parse(await getJson(`https://api.ashbyhq.com/posting-api/job-board/${token}`, ctx));
    roles = data.jobs
      .filter((job) => job.isListed !== false)
      .map((job) => ({
        provider: board.provider,
        id: job.id ?? new URL(job.jobUrl).pathname.split("/").filter(Boolean).at(-1),
        title: job.title,
        location: job.location,
        department: job.department,
        url: job.jobUrl,
        postedAt: date(job.publishedAt),
      }));
  } else return null;
  return z.array(AtsRoleSchema).parse(roles);
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  const overlap = [...left].filter((word) => right.has(word)).length;
  return left.size + right.size ? (2 * overlap) / (left.size + right.size) : 0;
}

function match(provider: Provider, posting: ParsedPosting, roles: readonly AtsRole[]): MatchResult {
  let best: MatchResult = {
    matched: false,
    confidence: 0,
    method: "none",
    reason: "No matching title and location found on this board.",
  };
  for (const role of roles) {
    if (role.provider !== provider) continue;
    if (posting.source === provider && posting.externalId && posting.externalId === role.id)
      return {
        matched: true,
        role,
        confidence: 1,
        method: "external_id",
        reason: "Same posting identifier listed on the employer's board.",
      };
    const title = similarity(normalizeTitle(posting.title), normalizeTitle(role.title));
    const hasLocation = Boolean(posting.location && role.location);
    const location = hasLocation
      ? similarity(normalizeText(posting.location!), normalizeText(role.location!))
      : 0;
    if (title < 0.75 || (hasLocation && location < 0.4)) continue;
    const confidence = title * (hasLocation ? 0.8 + location * 0.2 : 0.75);
    if (confidence > best.confidence)
      best = {
        matched: true,
        role,
        confidence,
        method: title === 1 ? "exact_title" : "fuzzy_title",
        reason: hasLocation
          ? "Similar title and compatible location listed on the employer's board."
          : "Similar title listed; location could not be confirmed.",
      };
  }
  return best;
}

function adapter(provider: Provider): AtsAdapter {
  return {
    id: provider,
    async detect(input, ctx) {
      try {
        const board = boardFromUrl(input, provider);
        return board && (await load(board, ctx)) !== null ? board : null;
      } catch {
        return null;
      }
    },
    async listOpenRoles(board, ctx) {
      if (board.provider !== provider) return [];
      try {
        return (await load(board, ctx)) ?? [];
      } catch {
        return [];
      }
    },
    findMatch: (posting, roles) => match(provider, posting, roles),
  };
}

export const greenhouse = adapter("greenhouse");
export const lever = adapter("lever");
export const ashby = adapter("ashby");
// TODO: implement Workday once a supported public interface is agreed.
export const workday: AtsAdapter = {
  id: "workday",
  detect: async () => null,
  listOpenRoles: async () => [],
  findMatch: () => ({
    matched: false,
    confidence: 0,
    method: "none",
    reason: "This careers provider is not supported yet.",
  }),
};
export const adapters: readonly AtsAdapter[] = [greenhouse, lever, ashby];
export async function detectBoard(
  input: string,
  ctx?: AtsContext,
  candidates: readonly AtsAdapter[] = adapters,
): Promise<{ adapter: AtsAdapter; board: AtsBoard } | null> {
  for (const adapter of candidates) {
    try {
      const board = await adapter.detect(input, ctx);
      if (board) return { adapter, board };
    } catch {
      /* Custom adapters must not break detection. */
    }
  }
  return null;
}
