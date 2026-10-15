import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
export const WEB_URL = "http://localhost:3100";
export const FIXTURES_URL = "http://127.0.0.1:4173";
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
