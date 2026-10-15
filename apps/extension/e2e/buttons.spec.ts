/// <reference types="chrome" />
// Every button and link in the web app and the side panel, including the gaps found in the
// October 2026 audit (docs/improvement-plan.md §1.1). Fictional data only.
import { TEST_IDS } from "@real-role/shared";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { EXTENSION_DIR, FIXTURES_URL, WEB_URL, chromiumLaunch } from "./env";

let context: BrowserContext;
let extensionId: string;
let page: Page;

const PASTED =
  "Bramblecrest Analytics is hiring a Platform Engineer on the Infrastructure team, reporting to the platform engineering manager. Own Kubernetes clusters and CI/CD. Salary $140,000–$165,000. Posted 3 days ago.";

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    ...chromiumLaunch(),
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

async function tabIdFor(url: string): Promise<number> {
  const worker = context.serviceWorkers()[0]!;
  const id = await worker.evaluate(
    async (u) => (await chrome.tabs.query({ url: u }))[0]?.id ?? null,
    url,
  );
  if (id === null) throw new Error(`No tab for ${url}`);
  return id;
}

test("header, landing and footer links", async () => {
  await page.goto(WEB_URL);
  await page.getByRole("link", { name: "Add to Chrome, free" }).click();
  await expect(page).toHaveURL(/\/extension$/);
  await expect(page.getByRole("heading", { name: "The score, where you browse" })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Check/ }).click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Check/ }),
  ).toHaveAttribute("aria-current", "page");

  for (const [name, path] of [
    ["How scoring works", "/how-it-works"],
    ["Chrome extension", "/extension"],
    ["Privacy", "/privacy"],
  ] as const) {
    await page.getByRole("contentinfo").getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }

  // Example chips switch the live example card.
  await page.goto(WEB_URL);
  await page.getByRole("radio", { name: "Reposted" }).click();
  await expect(page.getByTestId(TEST_IDS.web.band)).toHaveText(/low freshness/i);
  await page.getByRole("radio", { name: "Fresh" }).click();
  await expect(page.getByTestId(TEST_IDS.web.band)).toHaveText(/high freshness/i);
});

test("link previews and icons resolve", async () => {
  for (const path of ["/icon.svg", "/opengraph-image", "/apple-icon"]) {
    const res = await context.request.get(`${WEB_URL}${path}`);
    expect(res.status(), path).toBe(200);
  }
});

test("theme toggle and dark mode", async () => {
  await page.goto(WEB_URL);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();
  await page.getByRole("button", { name: /Theme: match system/ }).click(); // → light
  await page.getByRole("button", { name: /Theme: light/ }).click(); // → dark
  expect(await bg()).not.toBe(light);
  await page.reload();
  expect(await bg()).not.toBe(light); // remembered
  await page.getByRole("button", { name: /Theme: dark/ }).click(); // → system
  expect(await bg()).toBe(light);
});

test("check page: tabs, validation, errors", async () => {
  await page.goto(`${WEB_URL}/check`);
  const linkTab = page.getByRole("tab", { name: "Paste a link" });
  await linkTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Paste the text" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Paste the text" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(linkTab).toHaveAttribute("aria-selected", "true");

  await page.getByTestId(TEST_IDS.web.checkSubmit).click();
  await expect(page.getByText("Paste the link to a job posting.")).toBeVisible();
  await page.getByTestId(TEST_IDS.web.checkUrlInput).fill("jobs dot example");
  await page.getByTestId(TEST_IDS.web.checkSubmit).click();
  await expect(page.getByText(/doesn't look like a web link/)).toBeVisible();

  await page.getByTestId(TEST_IDS.web.checkUrlInput).fill("https://jobs.bramblecrest.invalid/1");
  await page.getByTestId(TEST_IDS.web.checkSubmit).click();
  await expect(page.getByTestId(TEST_IDS.web.checkError)).toContainText("couldn't find");
  await page.getByRole("button", { name: "Paste the text instead" }).click();
  await expect(page.getByTestId(TEST_IDS.web.checkTextInput)).toBeFocused();

  await page.getByTestId(TEST_IDS.web.checkTextInput).fill("Too short");
  await page.getByTestId(TEST_IDS.web.checkSubmit).click();
  await expect(page.getByText(/at least 50 characters/)).toBeVisible();
});

test("check page: save survives sign-in", async () => {
  await context.clearCookies();
  await page.goto(`${WEB_URL}/check?mode=text`);
  await page.getByTestId(TEST_IDS.web.checkTextInput).fill(PASTED);
  await page.getByTestId(TEST_IDS.web.checkSubmit).click();
  await expect(page.getByTestId(TEST_IDS.web.scoreCard)).toContainText("Platform Engineer");
  await page.getByRole("button", { name: "Save & track" }).click();
  const signIn = page.getByRole("link", { name: "Sign in" }).last();
  await expect(signIn).toHaveAttribute("href", /callbackUrl=%2Fcheck%3Fresume%3D1/);

  // Stand-in for the OAuth round trip: sign in, then land on the callback URL.
  expect((await context.request.post(`${WEB_URL}/api/dev/demo-session`)).ok()).toBe(true);
  await page.goto(`${WEB_URL}/check?resume=1`);
  await expect(page.getByTestId(TEST_IDS.web.scoreCard)).toContainText("Platform Engineer");
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expect(page).toHaveURL(/\/check$/);
});

test("dashboard: filters, dates, notes, manual add, undo", async () => {
  await context.request.post(`${WEB_URL}/api/dev/demo-session`);
  await page.goto(`${WEB_URL}/dashboard`);
  await expect(page.getByTestId(TEST_IDS.web.dashboard)).toBeVisible();

  // Manual add.
  await page.getByRole("button", { name: "+ Add manually" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an application" });
  await dialog.getByLabel("Job title").fill("Field Researcher");
  await dialog.getByLabel("Company").fill("Harrowgate Partners");
  await dialog.getByRole("button", { name: "Add application" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row", { name: /Field Researcher/ });
  await expect(row).toBeVisible();

  // Search and filters.
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search applications")).toBeFocused();
  await page.keyboard.type("harrowgate");
  await expect(page.getByRole("row")).toHaveCount(2); // header + one
  await page.getByLabel("Search applications").fill("");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(row).toBeHidden();
  await page.getByRole("button", { name: "All", exact: true }).click();

  // Follow-up date is editable, and persists.
  const date = row.getByLabel(/Follow-up date for/);
  await date.fill("2026-12-01");
  await expect(date).toHaveValue("2026-12-01");
  await page.reload();
  await expect(row.getByLabel(/Follow-up date for/)).toHaveValue("2026-12-01");

  // A past follow-up is due and can be marked done.
  await row.getByLabel(/Follow-up date for/).fill("2020-01-01");
  await expect(row.getByTestId(TEST_IDS.web.dashboardFollowUpDue)).toBeVisible();
  await row.getByRole("button", { name: /Mark followed up/ }).click();
  await expect(row.getByTestId(TEST_IDS.web.dashboardFollowUpDue)).toBeHidden();

  // Notes in the details drawer.
  await row.getByRole("button", { name: /Details/ }).click();
  const drawer = page.getByRole("dialog", { name: "Field Researcher" });
  await drawer.getByLabel("Notes").fill("Referred by a former colleague.");
  await drawer.getByRole("button", { name: "Save notes" }).click();
  await expect(drawer.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await page.reload();
  await expect(row).toContainText("notes");

  // Remove offers undo, then really removes.
  await row.getByTestId(TEST_IDS.web.dashboardRemove).click();
  await expect(row).toBeHidden();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
  await row.getByTestId(TEST_IDS.web.dashboardRemove).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("row", { name: /Field Researcher/ })).toHaveCount(0);
});

test("side panel: tracked state and next steps", async () => {
  await context.request.post(`${WEB_URL}/api/dev/demo-session`);
  const url = `${FIXTURES_URL}/jobs/vague`;
  await page.goto(url);
  await expect(page.getByTestId(TEST_IDS.extension.badgeScore)).toHaveText(/^\d+$/, {
    timeout: 30_000,
  });
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${await tabIdFor(url)}`);
  await panel.getByTestId(TEST_IDS.extension.saveButton).click();
  await expect(panel.getByTestId(TEST_IDS.extension.savedState)).toBeVisible();

  // Reopening the panel remembers it's tracked.
  await panel.reload();
  await expect(panel.getByTestId(TEST_IDS.extension.savedState)).toContainText(
    "On your dashboard: Saved",
  );
  await expect(panel.getByTestId(TEST_IDS.extension.saveButton)).toHaveCount(0);

  // Signal explanations expand.
  const why = panel.getByText("Why this matters").first();
  await why.click();
  await expect(panel.locator("details[open]").first()).toBeVisible();

  // A page that isn't a posting offers a way forward.
  const other = `${WEB_URL}/privacy`;
  await page.goto(other);
  await panel.goto(
    `chrome-extension://${extensionId}/sidepanel.html?tabId=${await tabIdFor(other)}`,
  );
  await panel.getByRole("button", { name: "Check this page" }).click();
  const empty = panel.getByTestId(TEST_IDS.extension.notAPosting);
  await expect(empty).toBeVisible({ timeout: 15_000 });
  await expect(empty.getByRole("link", { name: "Paste the posting text instead" })).toHaveAttribute(
    "href",
    `${WEB_URL}/check?mode=text`,
  );
  await empty.getByRole("button", { name: "Check this page again" }).click();
  await expect(empty).toBeVisible();
  await panel.close();
});

test("no sideways scrolling on a phone", async () => {
  await context.request.post(`${WEB_URL}/api/dev/demo-session`);
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 375, height: 800 });
  for (const path of ["/", "/check", "/dashboard", "/extension", "/signin", "/how-it-works"]) {
    await phone.goto(`${WEB_URL}${path}`);
    const width = await phone.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(375);
  }
  await phone.close();
});
