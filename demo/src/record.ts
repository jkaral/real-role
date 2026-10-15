import { chromium, expect } from "@playwright/test";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  TEST_IDS,
  SIGNAL_IDS,
  signalRowTestId,
  dashboardRowTestId,
  ListApplicationsResponseSchema,
  API_ROUTES,
} from "@real-role/shared";
import { startFixtureServer } from "./server";

export async function record(now: Date, webUrl: string): Promise<string> {
  const extension = resolve(
    process.env.DEMO_EXTENSION_PATH ?? "../apps/extension/.output/chrome-mv3",
  );
  await access(resolve(extension, "manifest.json"));
  const statePath = process.env.DEMO_STORAGE_STATE;
  if (!statePath)
    throw new Error(
      "DEMO_STORAGE_STATE must reference an isolated fictional demo account session.",
    );
  const state: unknown = JSON.parse(await readFile(statePath, "utf8"));
  const server = await startFixtureServer(now);
  const context = await chromium
    .launchPersistentContext("", {
      channel: "chromium",
      headless: false,
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: "output/raw", size: { width: 1920, height: 1080 } },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    .catch(async (error) => {
      await server.close();
      throw error;
    });
  try {
    const { z } = await import("zod");
    const cookieSchema = z.object({
      cookies: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
          domain: z.string(),
          path: z.string(),
          expires: z.number(),
          httpOnly: z.boolean(),
          secure: z.boolean(),
          sameSite: z.enum(["Strict", "Lax", "None"]),
        }),
      ),
    });
    await context.addCookies(cookieSchema.parse(state).cookies);
    await context.addInitScript(() => {
      document.addEventListener(
        "click",
        (event) => {
          const ring = document.createElement("div");
          ring.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #e9a931;border-radius:50%;width:40px;height:40px;left:${event.clientX - 20}px;top:${event.clientY - 20}px`;
          document.documentElement.append(ring);
          setTimeout(() => ring.remove(), 650);
        },
        true,
      );
    });
    const page = await context.newPage();
    const video = page.video();
    if (!video) throw new Error("Video recording was not started.");
    const started = Date.now();
    const until = async (seconds: number) => {
      const remaining = started + seconds * 1000 - Date.now();
      if (remaining < -1000)
        throw new Error(
          "Demo action exceeded its narration interval; refusing to truncate a product flow.",
        );
      if (remaining > 0) await page.waitForTimeout(remaining);
    };
    let saved = false;
    for (const [index, scenario] of server.fixtures.entries()) {
      await page.goto(scenario.posting.sourceUrl);
      await page.getByTestId(TEST_IDS.extension.badge).click();
      // This recorder requires the visible panel in the recorded page; fail instead of filming an empty page.
      await expect(page.getByTestId(TEST_IDS.extension.sidePanel)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(TEST_IDS.extension.band)).toHaveText(
        new RegExp(scenario.band, "i"),
      );
      const score = Number(await page.getByTestId(TEST_IDS.extension.score).innerText());
      expect(Number.isInteger(score) && score >= 0 && score <= 100).toBe(true);
      for (const id of SIGNAL_IDS)
        await expect(page.getByTestId(signalRowTestId(id))).toBeVisible();
      if (index === 0) {
        await page.getByTestId(TEST_IDS.extension.saveButton).click();
        await expect(page.getByTestId(TEST_IDS.extension.savedState)).toBeVisible();
        saved = true;
      }
      await until((index + 1) * 16);
    }
    if (!saved) throw new Error("No application was saved.");
    await page.goto(new URL("/dashboard", webUrl).href);
    await expect(page.getByTestId(TEST_IDS.web.dashboard)).toBeVisible();
    const response = await context.request.get(new URL(API_ROUTES.applications, webUrl).href);
    expect(response.ok()).toBe(true);
    const applications = ListApplicationsResponseSchema.parse(await response.json()).applications;
    const application = applications.find(
      (item) => item.sourceUrl === server.fixtures[0]!.posting.sourceUrl,
    );
    expect(application).toBeDefined();
    await expect(page.getByTestId(dashboardRowTestId(application!.id))).toBeVisible();
    await until(60);
    await page.close();
    return await video.path();
  } finally {
    await context.close();
    await server.close();
  }
}
