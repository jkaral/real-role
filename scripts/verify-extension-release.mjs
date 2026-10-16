#!/usr/bin/env node
// Verifies the Chrome extension release zip before it is published (see .github/workflows/release.yml).
//
//   node scripts/verify-extension-release.mjs [--dir apps/extension/.output] [--tag v0.1.0]
//                                            [--check-backend] [--checksum-out <file>]
//
// Fails (exit 1) on: zero or several zips, a version that doesn't match package.json or the tag,
// any non-production host (localhost, 127.0.0.1, demo fixtures), permissions or CSP that differ
// from the reviewed set, or missing icons/panel/background/content files. With --check-backend,
// it also fails when production answers 404 to an API path the extension calls, because a new
// extension must not ship before the backend that serves it.
// Uses only Node built-ins; zip entries are read from the central directory and inflated with zlib.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

export const PRODUCTION_ORIGIN = "https://real-role.vercel.app";
const EXPECTED_PERMISSIONS = ["activeTab", "scripting", "sidePanel", "storage"];
const EXPECTED_HOSTS = [`${PRODUCTION_ORIGIN}/*`];
const EXPECTED_CSP = {
  "script-src": ["'self'"],
  "object-src": ["'none'"],
  "connect-src": [PRODUCTION_ORIGIN],
};
const ICON_SIZES = ["16", "32", "48", "128"];
// Demo/e2e builds point at a local API and fictional fixtures; none of this may ship.
const FORBIDDEN_IN_BUNDLE = [
  /localhost/i,
  /127\.0\.0\.1/,
  /\[::1\]/,
  /[a-z0-9-]+\.example(?=[/"'`:])/i,
  /Bramblecrest|Northwind Lumen|Mapleglass/,
];

/** Read every entry of a zip archive into memory: Map<name, Buffer>. */
export function readZip(buf) {
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === eocdSig) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + compressed);
    if (!name.endsWith("/")) {
      if (method === 0) entries.set(name, Buffer.from(raw));
      else if (method === 8) entries.set(name, inflateRawSync(raw));
      else throw new Error(`unsupported compression method ${method} for ${name}`);
      if (entries.get(name).length !== size) throw new Error(`size mismatch for ${name}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function parseCsp(csp) {
  const out = {};
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Returns a list of problems; empty means the archive is releasable. */
export function verifyEntries(entries, { version, tag }) {
  const problems = [];
  const manifestBuf = entries.get("manifest.json");
  if (!manifestBuf) return ["manifest.json is missing"];
  let m;
  try {
    m = JSON.parse(manifestBuf.toString("utf8"));
  } catch {
    return ["manifest.json is not valid JSON"];
  }

  if (m.manifest_version !== 3) problems.push(`manifest_version is ${m.manifest_version}, not 3`);
  if (version && m.version !== version)
    problems.push(`manifest version ${m.version} != package.json version ${version}`);
  if (tag && !(tag === `v${m.version}` || tag.startsWith(`v${m.version}-`)))
    problems.push(`tag ${tag} doesn't match manifest version ${m.version}`);

  if (!same(m.permissions ?? [], EXPECTED_PERMISSIONS))
    problems.push(
      `permissions ${JSON.stringify(m.permissions)} != reviewed ${JSON.stringify(EXPECTED_PERMISSIONS)}`,
    );
  if (!same(m.host_permissions ?? [], EXPECTED_HOSTS))
    problems.push(
      `host_permissions ${JSON.stringify(m.host_permissions)} != ${JSON.stringify(EXPECTED_HOSTS)}`,
    );
  if (m.optional_permissions?.length || m.optional_host_permissions?.length)
    problems.push("optional permissions are not part of the reviewed set");
  if (m.web_accessible_resources?.length) problems.push("web_accessible_resources must be empty");
  if (JSON.stringify(m.externally_connectable) !== JSON.stringify({ ids: [] }))
    problems.push('externally_connectable must be { "ids": [] }');

  const csp = parseCsp(m.content_security_policy?.extension_pages ?? "");
  for (const [directive, values] of Object.entries(EXPECTED_CSP))
    if (!same(csp[directive] ?? [], values))
      problems.push(
        `CSP ${directive} is ${JSON.stringify(csp[directive])}, expected ${JSON.stringify(values)}`,
      );

  for (const cs of m.content_scripts ?? []) {
    for (const pattern of cs.matches ?? [])
      if (!pattern.startsWith("https://") || /localhost|127\.0\.0\.1|\.example/.test(pattern))
        problems.push(
          `content script match ${pattern} is not a production https job-board pattern`,
        );
    for (const file of cs.js ?? [])
      if (!entries.has(file)) problems.push(`content script ${file} missing`);
  }

  const required = [
    ...ICON_SIZES.map((s) => m.icons?.[s] ?? `icon ${s}`),
    m.side_panel?.default_path ?? "side_panel.default_path",
    m.background?.service_worker ?? "background.service_worker",
  ];
  for (const file of required)
    if (!entries.has(file)) problems.push(`required file ${file} missing`);

  for (const [name, buf] of entries) {
    if (!/\.(js|html|json|css)$/.test(name)) continue;
    const text = buf.toString("utf8");
    for (const re of FORBIDDEN_IN_BUNDLE) {
      const hit = text.match(re);
      if (hit) problems.push(`${name} contains non-production content "${hit[0]}"`);
    }
  }
  return problems;
}

/** API paths the bundle calls, e.g. "/api/score" (dynamic suffixes are dropped). */
export function apiPaths(entries) {
  const paths = new Set();
  for (const [name, buf] of entries) {
    if (!name.endsWith(".js")) continue;
    for (const match of buf.toString("utf8").matchAll(/["'`](\/api\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)/g))
      paths.add(match[1]);
  }
  return [...paths].sort();
}

/** Fails for any path production answers with 404 (401/405 etc. mean the route exists). */
export async function checkBackend(paths, { fetchImpl = fetch, origin = PRODUCTION_ORIGIN } = {}) {
  const problems = [];
  for (const path of paths) {
    let status = 0;
    for (let attempt = 0; attempt < 3 && (status === 0 || status >= 500); attempt++) {
      try {
        const res = await fetchImpl(new URL(path, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        status = res.status;
      } catch {
        status = 0;
      }
    }
    if (status === 404) problems.push(`production has no ${path} (404): deploy the backend first`);
    else if (status === 0 || status >= 500)
      problems.push(`couldn't check ${path} on production (status ${status || "no response"})`);
  }
  return problems;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dir = arg("--dir") ?? "apps/extension/.output";
  const tag =
    arg("--tag") ??
    (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
  const version = JSON.parse(readFileSync("apps/extension/package.json", "utf8")).version;
  const zips = readdirSync(dir).filter((f) => /^real-role-extension-.*-chrome\.zip$/.test(f));
  if (zips.length !== 1) {
    console.error(
      `Expected exactly one release zip in ${dir}, found ${zips.length}: ${zips.join(", ")}`,
    );
    process.exit(1);
  }
  const file = join(dir, zips[0]);
  const buf = readFileSync(file);
  const entries = readZip(buf);
  const problems = verifyEntries(entries, { version, tag });
  if (process.argv.includes("--check-backend"))
    problems.push(...(await checkBackend(apiPaths(entries))));
  if (problems.length) {
    console.error(`✗ ${file} is not releasable:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  const sha = createHash("sha256").update(buf).digest("hex");
  const out = arg("--checksum-out");
  if (out) writeFileSync(out, `${sha}  ${zips[0]}\n`);
  console.log(`✓ ${file} (${entries.size} files, v${version}) sha256 ${sha}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
