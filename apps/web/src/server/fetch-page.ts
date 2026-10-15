import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import { isIP } from "node:net";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Agent, fetch as undiciFetch } from "undici";
import { HttpError } from "./http";

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const USER_AGENT = "RealRoleCheck/1.0 (single page fetch requested by a user)";

const BLOCKED_MESSAGE = "Only public http(s) links can be checked.";
const UNREACHABLE_MESSAGE =
  "We couldn't reach that site. Check the link, or paste the posting text instead.";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Resolves a hostname to all its addresses (injectable for tests). */
export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) =>
    dnsLookup(hostname, { all: true } satisfies LookupAllOptions, (err, addresses) =>
      err ? reject(err) : resolve(addresses),
    ),
  );

class BlockedAddressError extends Error {
  readonly blocked = true;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * DNS lookup used by the HTTP agent for every connection (including redirects). Checking here,
 * at connect time, closes the DNS-rebinding gap of "check the name, then let fetch resolve it
 * again": the address we validate is the address we connect to.
 */
export function safeLookup(resolver: Resolver) {
  return (hostname: string, options: { all?: boolean }, callback: LookupCallback): void => {
    resolver(hostname).then(
      (addresses) => {
        const first = addresses[0];
        if (!first || addresses.some((a) => isPrivateAddress(a.address))) {
          callback(new BlockedAddressError(`Blocked address for ${hostname}`), "");
          return;
        }
        if (options.all) callback(null, addresses);
        else callback(null, first.address, first.family);
      },
      (err: NodeJS.ErrnoException) => callback(err, ""),
    );
  };
}

/** Did the agent's lookup block this connection? (undici wraps it in a fetch error's cause chain.) */
function isBlocked(error: unknown): boolean {
  let e: unknown = error;
  for (let depth = 0; depth < 5 && e instanceof Error; depth++) {
    if (e instanceof BlockedAddressError) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Validate a user-submitted URL: http(s), default ports, public host only. */
export async function assertPublicUrl(
  raw: string,
  resolver: Resolver = systemResolver,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("bad_request", "That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new HttpError("bad_request", BLOCKED_MESSAGE);
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new HttpError("bad_request", BLOCKED_MESSAGE);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new HttpError("bad_request", BLOCKED_MESSAGE);
  }
  // IP literals never reach the agent's DNS lookup, so they must be checked here.
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new HttpError("bad_request", BLOCKED_MESSAGE);
    return url;
  }
  // Early, friendlier errors; the connect-time lookup is what actually enforces the rule.
  const addresses = await resolver(host).catch(() => null);
  if (!addresses || addresses.length === 0) {
    throw new HttpError("upstream_unavailable", UNREACHABLE_MESSAGE);
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new HttpError("bad_request", BLOCKED_MESSAGE);
  }
  return url;
}

/** Read at most MAX_BYTES of the body, aborting larger responses instead of buffering them. */
async function readCapped(body: NodeReadableStream | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value as Uint8Array;
    total += chunk.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError("unparseable_posting", "That page is too large.");
    }
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const agents = new Map<Resolver, Agent>();
function agentFor(resolver: Resolver): Agent {
  let agent = agents.get(resolver);
  if (!agent) {
    agent = new Agent({ connect: { lookup: safeLookup(resolver) } });
    agents.set(resolver, agent);
  }
  return agent;
}

/**
 * Fetch the one page the user asked us to check (A2: no crawling, no cookies, no follow-up
 * requests). Redirects are followed manually so each hop is re-validated, and every connection's
 * address is checked by the agent's lookup.
 */
export async function fetchPostingPage(
  raw: string,
  resolver: Resolver = systemResolver,
): Promise<{ html: string; url: string }> {
  let url = await assertPublicUrl(raw, resolver);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const dispatcher = agentFor(resolver);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(url, {
        redirect: "manual",
        signal,
        dispatcher,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      });
    } catch (error) {
      if (isBlocked(error)) throw new HttpError("bad_request", BLOCKED_MESSAGE);
      throw new HttpError("upstream_unavailable", UNREACHABLE_MESSAGE);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) break;
      url = await assertPublicUrl(new URL(location, url).href, resolver);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(
        "upstream_unavailable",
        `That page returned an error (${response.status}).`,
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      await response.body?.cancel();
      throw new HttpError("unparseable_posting", "That link isn't a web page.");
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      await response.body?.cancel();
      throw new HttpError("unparseable_posting", "That page is too large.");
    }
    return { html: await readCapped(response.body), url: url.href };
  }
  throw new HttpError("upstream_unavailable", "That link redirects too many times.");
}
