// Run: node --test scripts/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { apiPaths, checkBackend, verifyEntries } from "./verify-extension-release.mjs";

const productionManifest = {
  manifest_version: 3,
  version: "0.1.0",
  icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
  permissions: ["sidePanel", "storage", "activeTab", "scripting"],
  host_permissions: ["https://real-role.vercel.app/*"],
  side_panel: { default_path: "sidepanel.html" },
  externally_connectable: { ids: [] },
  content_security_policy: {
    extension_pages:
      "default-src 'self'; script-src 'self'; object-src 'none'; connect-src https://real-role.vercel.app",
  },
  background: { service_worker: "background.js" },
  content_scripts: [{ matches: ["https://jobs.lever.co/*"], js: ["content-scripts/content.js"] }],
};

function entries(manifest = productionManifest, extra = {}) {
  const files = {
    "manifest.json": JSON.stringify(manifest),
    "background.js": 'fetch("https://real-role.vercel.app" + `/api/score`)',
    "sidepanel.html": "<!doctype html>",
    "content-scripts/content.js": "const examples = schema.examples;",
    "icon/16.png": "",
    "icon/32.png": "",
    "icon/48.png": "",
    "icon/128.png": "",
    ...extra,
  };
  return new Map(Object.entries(files).map(([k, v]) => [k, Buffer.from(v)]));
}

test("accepts the production build", () => {
  assert.deepEqual(verifyEntries(entries(), { version: "0.1.0", tag: "v0.1.0" }), []);
  assert.deepEqual(verifyEntries(entries(), { version: "0.1.0", tag: "v0.1.0-beta.1" }), []);
});

test("rejects a demo-configured manifest and bundle", () => {
  const demo = {
    ...productionManifest,
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none'; connect-src http://localhost:3100",
    },
    content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["content-scripts/content.js"] }],
  };
  const problems = verifyEntries(
    entries(demo, { "background.js": 'fetch("http://localhost:3100/api/score")' }),
    {
      version: "0.1.0",
    },
  );
  assert.ok(problems.some((p) => p.startsWith("host_permissions")));
  assert.ok(problems.some((p) => p.startsWith("CSP connect-src")));
  assert.ok(problems.some((p) => p.includes("127.0.0.1/*")));
  assert.ok(
    problems.some((p) => p.includes('background.js contains non-production content "localhost"')),
  );
});

test("rejects fixture content, extra permissions and missing files", () => {
  const manifest = {
    ...productionManifest,
    permissions: [...productionManifest.permissions, "tabs"],
  };
  const files = entries(manifest, {
    "chunks/x.js": 'const u = "https://jobs.bramblecrest.example/1"',
  });
  files.delete("icon/48.png");
  const problems = verifyEntries(files, { version: "0.1.0" });
  assert.ok(problems.some((p) => p.startsWith("permissions")));
  assert.ok(problems.some((p) => p.includes("bramblecrest.example")));
  assert.ok(problems.some((p) => p.includes("icon/48.png missing")));
});

test("rejects version and tag mismatches", () => {
  assert.ok(verifyEntries(entries(), { version: "0.2.0" }).some((p) => p.includes("package.json")));
  assert.ok(
    verifyEntries(entries(), { version: "0.1.0", tag: "v0.1.1" }).some((p) => p.startsWith("tag")),
  );
});

test("finds API paths and fails only on 404 from production", async () => {
  const paths = apiPaths(
    entries(productionManifest, {
      "chunks/a.js": 'post("/api/shortlist", x); `/api/applications/${id}`',
    }),
  );
  assert.deepEqual(paths, ["/api/applications", "/api/score", "/api/shortlist"]);
  const statuses = { "/api/score": 405, "/api/applications": 401, "/api/shortlist": 404 };
  const fetchImpl = async (url) => ({ status: statuses[new URL(url).pathname] });
  assert.deepEqual(await checkBackend(paths, { fetchImpl }), [
    "production has no /api/shortlist (404): deploy the backend first",
  ]);
});
