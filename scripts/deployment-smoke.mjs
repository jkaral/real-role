#!/usr/bin/env node
// Public deployment smoke test: GET-only checks of the production site, no secrets, no sign-in,
// no scoring and no writes. See docs/deployment-runbook.md.
//
//   node scripts/deployment-smoke.mjs [--with-addons] [--origin http://127.0.0.1:PORT]
//
// The destination is fixed to the production origin. --origin accepts only loopback addresses,
// for testing the script against a local server or stub; it never fetches arbitrary URLs.
// Redirects are not followed: each check asserts the status and, for redirects, the target.

export const PRODUCTION_ORIGIN = "https://real-role.vercel.app";

/** @typedef {{ path: string, status: number, html?: RegExp, location?: RegExp, note: string }} Check */

/** @type {Check[]} */
export const CORE_CHECKS = [
  { path: "/", status: 200, html: /Real Role/, note: "landing page" },
  { path: "/check", status: 200, html: /Real Role/, note: "check a posting" },
  { path: "/how-it-works", status: 200, html: /Freshness Score/, note: "scoring explainer" },
  { path: "/privacy", status: 200, html: /Privacy/, note: "privacy policy" },
  { path: "/signin", status: 200, html: /Sign in|sign in/, note: "sign-in page" },
  { path: "/extension", status: 200, html: /extension/i, note: "extension install page (#12)" },
  {
    path: "/dashboard",
    status: 307,
    location: /^\/signin\b/,
    note: "dashboard redirects signed-out visitors to sign-in",
  },
  { path: "/api/applications", status: 401, note: "applications API needs sign-in" },
];

/** Added by PR #24; enable with --with-addons once that backend is deployed. */
/** @type {Check[]} */
export const ADDON_CHECKS = [
  {
    path: "/shortlist",
    status: 307,
    location: /^\/signin\?callbackUrl=%2Fshortlist|^\/signin\?callbackUrl=\/shortlist/,
    note: "shortlist redirects signed-out visitors to sign-in",
  },
  {
    path: "/insights",
    status: 307,
    location: /^\/signin\?callbackUrl=%2Finsights|^\/signin\?callbackUrl=\/insights/,
    note: "insights redirects signed-out visitors to sign-in",
  },
  {
    path: "/coach",
    status: 200,
    html: /Coach workspace/,
    note: "coach page renders a sign-in prompt",
  },
  { path: "/api/shortlist", status: 401, note: "shortlist API needs sign-in" },
];

const TIMEOUT_MS = 10_000;
const ATTEMPTS = 3;

export function resolveOrigin(requested) {
  if (!requested) return PRODUCTION_ORIGIN;
  const url = new URL(requested);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (requested.replace(/\/$/, "") === PRODUCTION_ORIGIN) return PRODUCTION_ORIGIN;
  if (!loopback || url.protocol !== "http:") {
    throw new Error(
      `--origin must be ${PRODUCTION_ORIGIN} or an http loopback address, got ${requested}`,
    );
  }
  return url.origin;
}

async function fetchOnce(fetchImpl, url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "RealRoleDeploymentSmoke/1.0" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 500 && attempt < ATTEMPTS) continue;
      return res;
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

/** Runs the checks; returns { passed, failures } where each failure explains what was wrong. */
export async function runSmoke({
  origin = PRODUCTION_ORIGIN,
  withAddons = false,
  fetchImpl = fetch,
} = {}) {
  const checks = withAddons ? [...CORE_CHECKS, ...ADDON_CHECKS] : CORE_CHECKS;
  const failures = [];
  const passed = [];
  for (const check of checks) {
    const url = new URL(check.path, origin);
    let res;
    try {
      res = await fetchOnce(fetchImpl, url);
    } catch (error) {
      failures.push(`${check.path}: no response (${error?.name ?? "error"}) — ${check.note}`);
      continue;
    }
    const problems = [];
    // Next.js may use 307 or 308 for redirects; accept either when a redirect is expected.
    const statusOk =
      res.status === check.status || (check.location && [302, 303, 307, 308].includes(res.status));
    if (!statusOk) problems.push(`status ${res.status}, expected ${check.status}`);
    if (check.location) {
      const raw = res.headers.get("location") ?? "";
      const location = raw.startsWith(origin) ? raw.slice(origin.length) : raw;
      if (!check.location.test(location)) problems.push(`redirects to "${raw || "(none)"}"`);
    }
    if (check.html && res.status === 200) {
      const type = res.headers.get("content-type") ?? "";
      const body = await res.text();
      if (!type.includes("text/html")) problems.push(`content-type "${type}", expected HTML`);
      else if (!check.html.test(body)) problems.push(`page doesn't contain ${check.html}`);
    } else {
      await res.body?.cancel?.();
    }
    if (problems.length) failures.push(`${check.path}: ${problems.join("; ")} — ${check.note}`);
    else passed.push(check.path);
  }
  return { passed, failures };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const origin = resolveOrigin(arg("--origin"));
  const withAddons = process.argv.includes("--with-addons");
  console.log(`Smoke-testing ${origin}${withAddons ? " (with add-on routes)" : ""}`);
  const { passed, failures } = await runSmoke({ origin, withAddons });
  for (const path of passed) console.log(`  ✓ ${path}`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  if (failures.length) {
    console.error(
      `\n${failures.length} check(s) failed. A missing route usually means production hasn't been redeployed since it was merged; see docs/deployment-runbook.md.`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${passed.length} checks passed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
