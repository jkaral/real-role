// Run: node --test scripts/*.test.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { ADDON_CHECKS, CORE_CHECKS, resolveOrigin, runSmoke } from "./deployment-smoke.mjs";

/** A stand-in for the deployed site: serves each check's expected response unless overridden. */
function stubSite(overrides = {}) {
  const responses = {};
  for (const check of [...CORE_CHECKS, ...ADDON_CHECKS]) {
    const name = check.path.slice(1) || "home";
    responses[check.path] = check.location
      ? { status: 307, headers: { location: `/signin?callbackUrl=%2F${name}` } }
      : check.status === 200
        ? {
            status: 200,
            headers: { "content-type": "text/html" },
            body: "<title>Real Role</title> Freshness Score Privacy Sign in extension Coach workspace",
          }
        : { status: check.status, headers: { "content-type": "application/json" }, body: "{}" };
  }
  Object.assign(responses, overrides);
  return createServer((req, res) => {
    const r = responses[req.url] ?? { status: 404, body: "not found" };
    res.writeHead(r.status, r.headers ?? {});
    res.end(r.body ?? "");
  });
}

const servers = [];
async function serve(site) {
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
  servers.push(site);
  return `http://127.0.0.1:${site.address().port}`;
}
after(() => servers.forEach((s) => s.close()));

test("passes against a site that serves every route", async () => {
  const origin = await serve(stubSite());
  const { failures, passed } = await runSmoke({ origin, withAddons: true });
  assert.deepEqual(failures, []);
  assert.equal(passed.length, CORE_CHECKS.length + ADDON_CHECKS.length);
});

test("fails on the old deployment, where /extension is missing", async () => {
  const origin = await serve(stubSite({ "/extension": { status: 404, body: "not found" } }));
  const { failures } = await runSmoke({ origin });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^\/extension: status 404, expected 200/);
});

test("fails when a protected page stops redirecting, or the API stops requiring sign-in", async () => {
  const origin = await serve(
    stubSite({
      "/dashboard": { status: 200, headers: { "content-type": "text/html" }, body: "Real Role" },
      "/api/applications": { status: 200, body: "[]" },
    }),
  );
  const { failures } = await runSmoke({ origin });
  assert.ok(failures.some((f) => f.startsWith("/dashboard:")));
  assert.ok(failures.some((f) => f.startsWith("/api/applications: status 200, expected 401")));
});

test("add-on routes are only checked when asked", async () => {
  const origin = await serve(stubSite({ "/shortlist": { status: 404, body: "" } }));
  assert.deepEqual((await runSmoke({ origin })).failures, []);
  assert.ok(
    (await runSmoke({ origin, withAddons: true })).failures.some((f) =>
      f.startsWith("/shortlist:"),
    ),
  );
});

test("only the production origin or loopback can be targeted", () => {
  assert.equal(resolveOrigin(undefined), "https://real-role.vercel.app");
  assert.equal(resolveOrigin("http://127.0.0.1:3100/"), "http://127.0.0.1:3100");
  assert.throws(() => resolveOrigin("https://example.com"));
  assert.throws(() => resolveOrigin("http://10.0.0.5"));
  assert.throws(() => resolveOrigin("https://real-role.vercel.app.evil.example"));
});
