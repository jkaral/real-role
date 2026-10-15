import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./http";

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const USER_AGENT = "RealRoleCheck/1.0 (single page fetch requested by a user)";

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

/** Validate a user-submitted URL: http(s), default ports, public host only. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("bad_request", "That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new HttpError("bad_request", "Only public http(s) links can be checked.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new HttpError("bad_request", "Only public http(s) links can be checked.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new HttpError("bad_request", "Only public http(s) links can be checked.");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new HttpError("bad_request", "Only public http(s) links can be checked.");
  }
  return url;
}

/**
 * Fetch the one page the user asked us to check (A2: no crawling, no cookies, no follow-up
 * requests). Redirects are followed manually so each hop is re-validated.
 */
export async function fetchPostingPage(raw: string): Promise<{ html: string; url: string }> {
  let url = await assertPublicUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        credentials: "omit",
        signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      throw new HttpError("upstream_unavailable", "We couldn't reach that page.");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      throw new HttpError(
        "upstream_unavailable",
        `That page returned an error (${response.status}).`,
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      throw new HttpError("unparseable_posting", "That link isn't a web page.");
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new HttpError("unparseable_posting", "That page is too large.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES)
      throw new HttpError("unparseable_posting", "That page is too large.");
    return { html: new TextDecoder().decode(buffer), url: url.href };
  }
  throw new HttpError("upstream_unavailable", "That link redirects too many times.");
}
