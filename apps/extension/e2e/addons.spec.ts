import { chromium, expect, test } from "@playwright/test";
import { TEST_IDS } from "@real-role/shared";
import { WEB_URL, chromiumLaunch } from "./env";

test("synced preferences, comparison, calendar, analytics, CSV and local brief", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  const context = await chromium.launchPersistentContext("", {
    ...chromiumLaunch(),
    acceptDownloads: true,
  });
  try {
    expect((await context.request.post(`${WEB_URL}/api/dev/demo-session`)).ok()).toBe(true);
    const ids: string[] = [];
    for (const [title, company, pay] of [
      ["Infrastructure Engineer", "Bramblecrest Analytics", 140000],
      ["Research Analyst", "Northwind Lumen", 80000],
    ] as const) {
      const score = await context.request.post(`${WEB_URL}/api/score`, {
        data: {
          kind: "parsed",
          posting: {
            title,
            company,
            location: "Toronto",
            remote: true,
            employmentType: "FULL_TIME",
            salary: { min: pay - 10000, max: pay, currency: "CAD", period: "year" },
            descriptionText:
              "Own deployment pipelines for the infrastructure team. Requires 3 years of experience.",
            sourceUrl: `https://${company.startsWith("Bramblecrest") ? "bramblecrest" : "northwind"}.example/jobs/priority`,
            source: "generic",
            parsedBy: "test",
          },
        },
      });
      expect(score.ok()).toBe(true);
      const result = await score.json();
      const save = await context.request.post(`${WEB_URL}/api/shortlist`, {
        data: {
          postingId: result.postingId,
          facts: {
            location: "Toronto",
            remote: true,
            salary: result.posting.salary,
            experienceMinYears: 3,
          },
        },
      });
      expect(save.ok()).toBe(true);
      ids.push((await save.json()).application.id);
    }
    const page = await context.newPage();
    await page.goto(`${WEB_URL}/shortlist`);
    await page.getByLabel("Job titles (comma separated)").fill("engineer");
    await page.getByLabel("Minimum pay").fill("100000");
    await page.getByLabel("Currency", { exact: true }).fill("CAD");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByRole("status")).toContainText("Preferences saved");
    await page.reload();
    await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("CAD");
    await page
      .getByRole("checkbox", { name: "Compare Infrastructure Engineer at Bramblecrest Analytics" })
      .check();
    await page
      .getByRole("checkbox", { name: "Compare Research Analyst at Northwind Lumen" })
      .check();
    const comparison = page.getByRole("region", { name: "Job comparison" });
    await expect(comparison.getByRole("table")).toBeVisible();
    await expect(comparison).toContainText("140000 CAD/year");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("shortlist-desktop.png"), fullPage: true });
    expect(
      (
        await context.request.patch(`${WEB_URL}/api/applications/${ids[0]}`, {
          data: { status: "interviewing", followUpAt: "2026-12-01T14:00:00Z" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`${WEB_URL}/dashboard`);
    const row = page.getByRole("row", { name: /Infrastructure Engineer/ });
    await row.getByRole("button", { name: /Details/ }).click();
    const drawer = page.getByRole("dialog", { name: "Infrastructure Engineer" });
    const download = page.waitForEvent("download");
    await drawer.getByRole("button", { name: "Download calendar event (.ics)" }).click();
    expect((await download).suggestedFilename()).toBe("real-role-follow-up.ics");
    await expect(drawer.getByLabel("Editable message template")).toContainText("conversation");
    await page.keyboard.press("Escape");
    await page.getByText("Import or export applications", { exact: true }).click();
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    expect((await csvDownload).suggestedFilename()).toBe("real-role-applications.csv");
    const headers =
      "title,company,url,status,appliedAt,followUpAt,notes,location,remote,employmentType,salaryMin,salaryMax,currency,payPeriod,experienceMinYears";
    const csv =
      headers +
      "\r\nCSV Test Analyst,Mapleglass Labs,https://mapleglass.example/jobs/csv,saved,,,,Toronto,true,FULL_TIME,80000,100000,CAD,year,2\r\n";
    await page
      .getByLabel("Choose CSV to preview")
      .setInputFiles({ name: "applications.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("1 new rows; 0 duplicate rows will be skipped.")).toBeVisible();
    await page.getByRole("button", { name: "Confirm import (1 new)" }).click();
    await expect(page.getByText(/Imported 1; skipped 0 duplicates/)).toBeVisible();
    await expect(page.getByRole("row", { name: /CSV Test Analyst/ })).toBeVisible();
    await page.goto(`${WEB_URL}/insights`);
    await expect(page.getByRole("heading", { name: "Your search insights" })).toBeVisible();
    await expect(page.getByText(/Infrastructure Engineer: saved → interviewing/)).toBeVisible();
    await page.goto(`${WEB_URL}/check?mode=text`);
    await page
      .getByTestId(TEST_IDS.web.checkTextInput)
      .fill(
        "Mapleglass Labs seeks a Data Analyst. Own monthly reporting and maintain data pipelines for the analytics team. At least 2 years of experience.",
      );
    await page.getByTestId(TEST_IDS.web.checkSubmit).click();
    await expect(page.getByTestId(TEST_IDS.web.scoreCard)).toBeVisible();
    await page.getByRole("button", { name: "Build interview brief" }).click();
    await expect(page.getByLabel("Editable preparation notes")).toContainText(
      "Own monthly reporting",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB_URL}/shortlist`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("shortlist-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Clear preferences", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Preferences cleared");
  } finally {
    await context.close();
  }
});
