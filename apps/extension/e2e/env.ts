import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
export const WEB_URL = "http://localhost:3100";
const fixturePort = Number(process.env.RR_E2E_FIXTURE_PORT ?? "4173");
if (!Number.isInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65535)
  throw new Error("RR_E2E_FIXTURE_PORT must be a port between 1024 and 65535.");
export const FIXTURES_URL = `http://127.0.0.1:${fixturePort}`;
export const EXTENSION_DIR = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));
export const PGLITE_DIR = fileURLToPath(new URL("../../web/.pglite-e2e", import.meta.url));

/**
 * Chromium launch options. `PW_CHROMIUM_PATH` points at a preinstalled Chromium when it differs
 * from the build this Playwright version pins (e.g. sandboxes without `playwright install`).
 */
export function chromiumLaunch(): { channel?: string; executablePath?: string } {
  const path = process.env.PW_CHROMIUM_PATH;
  return path ? { executablePath: path } : { channel: "chromium" };
}
