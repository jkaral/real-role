/// <reference types="chrome" />
// Chrome Web Store screenshots (1280x800) from the real extension on the fictional demo fixtures.
// Opt-in: SCREENSHOTS=1 pnpm --filter @real-role/extension e2e
import { TEST_IDS } from "@real-role/shared";
import { chromium, expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXTENSION_DIR, FIXTURES_URL } from "./env";

const OUT = fileURLToPath(new URL("../store/", import.meta.url));

test.skip(process.env.SCREENSHOTS !== "1", "set SCREENSHOTS=1 to regenerate store screenshots");

test("store screenshots", async () => {
  mkdirSync(OUT, { recursive: true });
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    viewport: { width: 880, height: 800 },
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;

  for (const [i, slug] of ["fresh", "reposted", "vague"].entries()) {
    const url = `${FIXTURES_URL}/jobs/${slug}`;
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.getByTestId(TEST_IDS.extension.badgeScore)).toHaveText(/^\d+$/, {
      timeout: 30_000,
    });
    const pageShot = await page.screenshot();

    const tabId = await worker.evaluate(
      async (u) => (await chrome.tabs.query({ url: u }))[0]?.id,
      url,
    );
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 400, height: 800 });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
    await expect(panel.getByTestId(TEST_IDS.extension.band)).toBeVisible();
    const panelShot = await panel.screenshot();

    // Compose page + side panel the way Chrome shows them.
    const compose = await context.newPage();
    await compose.setViewportSize({ width: 1280, height: 800 });
    const img = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
    await compose.setContent(
      `<body style="margin:0;display:flex;background:#d7dedb"><img src="${img(pageShot)}" width="880" height="800">` +
        `<img src="${img(panelShot)}" width="400" height="800" style="border-left:1px solid #b9c4bf"></body>`,
    );
    await compose.screenshot({ path: `${OUT}screenshot-${i + 1}-${slug}.png` });
    await Promise.all([page.close(), panel.close(), compose.close()]);
  }
  await context.close();
  expect(readFileSync(`${OUT}screenshot-1-fresh.png`).length).toBeGreaterThan(10_000);
});
