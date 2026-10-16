import { chromium, expect, test } from "@playwright/test";
import { TEST_IDS } from "@real-role/shared";
import { WEB_URL, EXTENSION_DIR, FIXTURES_URL, chromiumLaunch } from "./env";

test("employer source finder on web and real extension panel", async () => {
  const context = await chromium.launchPersistentContext("", {
    ...chromiumLaunch(),
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`${WEB_URL}/check?mode=text`);
    await page
      .getByTestId(TEST_IDS.web.checkTextInput)
      .fill(
        "Bramblecrest Analytics is hiring a Platform Engineer to maintain Kubernetes clusters and improve the infrastructure. Report to the platform manager.",
      );
    await page.getByTestId(TEST_IDS.web.checkSubmit).click();
    await expect(page.getByTestId(TEST_IDS.web.scoreCard)).toBeVisible();
    const section = page.getByRole("region", { name: "Employer source" });
    await section.getByRole("button", { name: "Find employer listing" }).click();
    await expect(section).toContainText("Add the employer’s hosted");
    await section
      .getByLabel("Employer’s board URL", { exact: false })
      .fill("https://bramblecrest.example/careers");
    await section.getByRole("button", { name: "Find employer listing" }).click();
    await expect(section).toContainText("Other career sites are not supported");

    const response = {
      status: "matched",
      checkedAt: "2026-10-15T12:00:00Z",
      boardUrl: "https://jobs.lever.co/bramblecrest",
      listing: {
        title: "Platform Engineer",
        location: "Toronto",
        url: "https://jobs.lever.co/bramblecrest/42",
        exactListing: false,
        reason: "Similar title and compatible location listed on this board.",
      },
    };
    let calls = 0;
    await context.route("**/api/employer-source", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.posting.descriptionText).toBe("");
      calls++;
      await route.fulfill({ json: response });
    });
    await section.getByLabel("Employer’s board URL", { exact: false }).fill(response.boardUrl);
    await section.getByRole("button", { name: "Find employer listing" }).click();
    await expect(
      section.getByRole("link", { name: "Open possible matching listing" }),
    ).toHaveAttribute("href", response.listing.url);

    const fixtureUrl = `${FIXTURES_URL}/jobs/fresh`;
    await page.goto(fixtureUrl);
    await expect(page.getByTestId(TEST_IDS.extension.badgeScore)).toHaveText(/^\d{1,3}$/);
    const tabId = await worker.evaluate(
      async (url) => (await chrome.tabs.query({ url }))[0]?.id,
      fixtureUrl,
    );
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
    const panelSource = panel.getByRole("region", { name: "Employer source" });
    await panelSource.getByRole("button", { name: "Find employer listing" }).click();
    await expect(
      panelSource.getByRole("link", { name: "Open possible matching listing" }),
    ).toHaveAttribute("href", response.listing.url);
    expect(calls).toBe(2);
  } finally {
    await context.close();
  }
});
