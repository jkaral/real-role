/// <reference types="chrome" />
import {
  TEST_IDS,
  signalRowTestId,
  SIGNAL_IDS,
  dashboardRowTestId,
  ListApplicationsResponseSchema,
} from "@real-role/shared";
import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";
import { EXTENSION_DIR, FIXTURES_URL, chromiumLaunch, WEB_URL } from "./env";

let context: BrowserContext;
let worker: Worker;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    ...chromiumLaunch(),
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

async function tabIdFor(url: string): Promise<number> {
  const id = await worker.evaluate(async (u) => {
    const tabs = await chrome.tabs.query({ url: u });
    return tabs[0]?.id ?? null;
  }, url);
  if (id === null) throw new Error(`No tab for ${url}`);
  return id;
}

const FIXTURES = [
  { slug: "fresh", band: /high freshness/i },
  { slug: "reposted", band: /low freshness/i },
  { slug: "vague", band: /medium freshness/i },
] as const;

test("badge, side panel, save & track, dashboard", async () => {
  const page = await context.newPage();

  for (const fixture of FIXTURES) {
    const url = `${FIXTURES_URL}/jobs/${fixture.slug}`;
    await page.goto(url);

    // In-page badge (shadow DOM) shows a numeric score.
    const badgeScore = page.getByTestId(TEST_IDS.extension.badgeScore);
    await expect(badgeScore).toHaveText(/^\d{1,3}$/, { timeout: 30_000 });
    const score = await badgeScore.innerText();

    // Side panel page, rendered standalone for this tab.
    const panel = await context.newPage();
    await panel.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${await tabIdFor(url)}`,
    );
    await expect(panel.getByTestId(TEST_IDS.extension.sidePanel)).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.extension.score)).toHaveText(score);
    await expect(panel.getByTestId(TEST_IDS.extension.band)).toHaveText(fixture.band);
    for (const id of SIGNAL_IDS) await expect(panel.getByTestId(signalRowTestId(id))).toBeVisible();

    if (fixture.slug === "fresh") {
      // Signed out: saving asks the user to sign in.
      await panel.getByTestId(TEST_IDS.extension.saveButton).click();
      await expect(panel.getByTestId(TEST_IDS.extension.signInPrompt)).toBeVisible();

      // Sign in on the web app (local demo sign-in), then save again from the extension.
      const res = await context.request.post(`${WEB_URL}/api/dev/demo-session`);
      expect(res.ok()).toBe(true);
      await panel.getByTestId(TEST_IDS.extension.saveButton).click();
      await expect(panel.getByTestId(TEST_IDS.extension.savedState)).toBeVisible();
    }
    await panel.close();
  }

  // The saved posting is on the dashboard.
  const api = await context.request.get(`${WEB_URL}/api/applications`);
  const { applications } = ListApplicationsResponseSchema.parse(await api.json());
  const saved = applications.find((a) => a.sourceUrl === `${FIXTURES_URL}/jobs/fresh`);
  expect(saved).toBeDefined();
  await page.goto(`${WEB_URL}/dashboard`);
  await expect(page.getByTestId(TEST_IDS.web.dashboard)).toBeVisible();
  await expect(page.getByTestId(dashboardRowTestId(saved!.id))).toContainText("Platform Engineer");
});

test("SPA navigation during the initial delayed parse checks the new posting", async () => {
  const page = await context.newPage();
  const loadingUrl = `${FIXTURES_URL}/jobs/loading`;
  await page.route(loadingUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body><p>Loading the selected role…</p></body></html>",
    }),
  );
  await page.goto(loadingUrl);
  const tabId = await tabIdFor(loadingUrl);
  // Wait for injection, while the initial posting parser is still waiting for content.
  await expect
    .poll(() =>
      worker.evaluate(async (id) => {
        const results = await chrome.scripting.executeScript({
          target: { tabId: id },
          func: () => Boolean((window as Window & { __realRoleLoaded?: boolean }).__realRoleLoaded),
        });
        return results[0]?.result;
      }, tabId),
    )
    .toBe(true);

  await page.evaluate(async (url) => {
    const html = await (await fetch(url)).text();
    const next = new DOMParser().parseFromString(html, "text/html");
    document.body.replaceChildren(...Array.from(next.body.childNodes));
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
    next.head
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((s) => document.head.append(s));
    history.pushState(null, "", url);
  }, `${FIXTURES_URL}/jobs/vague`);

  await expect(page.getByTestId(TEST_IDS.extension.badgeScore)).toHaveText(/^\d{1,3}$/, {
    timeout: 30_000,
  });
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
  await expect(panel.getByTestId(TEST_IDS.extension.band)).toHaveText(/medium freshness/i);
  await expect(panel.getByTestId(TEST_IDS.extension.score)).toHaveText(
    await page.getByTestId(TEST_IDS.extension.badgeScore).innerText(),
  );
  await panel.close();
  await page.close();
});
