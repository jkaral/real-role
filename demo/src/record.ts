import { chromium, expect } from "@playwright/test";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  API_ROUTES,
  dashboardRowTestId,
  ListApplicationsResponseSchema,
  SIGNAL_IDS,
  signalRowTestId,
  TEST_IDS,
} from "@real-role/shared";
import { startFixtureServer } from "./server";

/** Composite only pixels captured from the real posting, extension panel and dashboard. */
export async function record(now: Date, webUrl: string): Promise<string> {
  const extension = resolve(
    process.env.DEMO_EXTENSION_PATH ?? "../apps/extension/.output/chrome-mv3",
  );
  await access(resolve(extension, "manifest.json"));
  const server = await startFixtureServer(now);
  const context = await chromium
    .launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      viewport: { width: 1280, height: 1080 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    .catch(async (error) => {
      await server.close();
      throw error;
    });
  let running = false;
  let recording: Promise<void> | undefined;
  let captureError: unknown;
  try {
    await context.addInitScript(() =>
      document.addEventListener(
        "click",
        (event) => {
          const ring = document.createElement("div");
          ring.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #e9a931;border-radius:50%;width:40px;height:40px;left:${event.clientX - 20}px;top:${event.clientY - 20}px`;
          document.documentElement.append(ring);
          setTimeout(() => ring.remove(), 650);
        },
        true,
      ),
    );
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const response = await context.request.post(new URL("/api/dev/demo-session", webUrl).href);
    expect(response.ok()).toBe(true);
    await context.storageState({ path: "output/demo-session.json" });
    const page = await context.newPage();
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 640, height: 1080 });
    const stage = await context.newPage();
    await stage.setViewportSize({ width: 1920, height: 1080 });
    await stage.setContent(
      '<html><body style="margin:0;background:#f6f8f7"><canvas width="1920" height="1080"></canvas></body></html>',
    );
    const frameDir = resolve("output/frames", new Date().toISOString().replace(/[:.]/g, "-"));
    await mkdir(frameDir, { recursive: true });
    let display: "posting" | "dashboard" = "posting";
    let capturing = false;
    const frames: { path: string; time: number }[] = [];
    const capture = async () => {
      if (capturing) return;
      capturing = true;
      try {
        const screenshots =
          display === "dashboard"
            ? [await page.screenshot()]
            : await Promise.all([page.screenshot(), panel.screenshot()]);
        await stage.evaluate(
          async ({ images, dashboard }) => {
            const canvas = document.querySelector("canvas")!;
            const drawing = canvas.getContext("2d")!;
            drawing.fillStyle = "#f6f8f7";
            drawing.fillRect(0, 0, 1920, 1080);
            for (const [index, source] of images.entries()) {
              const img = new Image();
              img.src = source;
              await img.decode();
              drawing.drawImage(
                img,
                index === 0 ? 0 : 1280,
                0,
                dashboard ? 1920 : index === 0 ? 1280 : 640,
                1080,
              );
            }
            if (!dashboard) {
              drawing.fillStyle = "#bacbc2";
              drawing.fillRect(1279, 0, 2, 1080);
            }
          },
          {
            images: screenshots.map(
              (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
            ),
            dashboard: display === "dashboard",
          },
        );
        const path = resolve(frameDir, `${String(frames.length).padStart(5, "0")}.png`);
        const time = Date.now();
        await stage.screenshot({ path });
        frames.push({ path, time });
      } finally {
        capturing = false;
      }
    };
    const open = async (url: string) => {
      await page.goto(url);
      await expect(page.getByTestId(TEST_IDS.extension.badgeScore)).toHaveText(/^\d{1,3}$/, {
        timeout: 30000,
      });
      await page.getByTestId(TEST_IDS.extension.badge).click();
      const tabId = await worker.evaluate(async (url) => {
        const api = (
          globalThis as unknown as {
            chrome: { tabs: { query: (query: { url: string }) => Promise<{ id?: number }[]> } };
          }
        ).chrome;
        return (await api.tabs.query({ url }))[0]?.id;
      }, url);
      if (tabId === undefined) throw new Error("Posting tab not found in the real extension.");
      await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
      await expect(panel.getByTestId(TEST_IDS.extension.sidePanel)).toBeVisible();
    };
    await open(server.fixtures[0]!.posting.sourceUrl);
    await capture();
    const started = frames[0]!.time;
    running = true;
    recording = (async () => {
      while (running) {
        const start = Date.now();
        await capture();
        await new Promise((done) => setTimeout(done, Math.max(0, 250 - (Date.now() - start))));
      }
    })().catch((error) => {
      captureError = error;
      running = false;
    });
    const until = async (seconds: number) => {
      if (captureError) throw captureError;
      const remaining = started + seconds * 1000 - Date.now();
      if (remaining < -1500) throw new Error(`Demo exceeded its ${seconds}s narration interval.`);
      if (remaining > 0) await new Promise((done) => setTimeout(done, remaining));
      if (captureError) throw captureError;
    };
    const scores: { slug: string; score: number; band: string }[] = [];
    for (const [index, scenario] of server.fixtures.entries()) {
      if (index) await open(scenario.posting.sourceUrl);
      await expect(panel.getByTestId(TEST_IDS.extension.band)).toHaveText(
        new RegExp(`${scenario.band} freshness`, "i"),
      );
      await expect(panel.getByTestId(TEST_IDS.extension.score)).toHaveText(
        await page.getByTestId(TEST_IDS.extension.badgeScore).innerText(),
      );
      const score = Number(await panel.getByTestId(TEST_IDS.extension.score).innerText());
      expect(Number.isInteger(score) && score >= 0 && score <= 100).toBe(true);
      for (const id of SIGNAL_IDS)
        await expect(panel.getByTestId(signalRowTestId(id))).toBeVisible();
      scores.push({ slug: scenario.slug, score, band: scenario.band });
      if (!index) {
        await until(6);
        await panel.getByTestId(TEST_IDS.extension.saveButton).click();
        await expect(panel.getByTestId(TEST_IDS.extension.savedState)).toBeVisible();
      }
      await until((index + 1) * 16);
    }
    const apps = await context.request.get(new URL(API_ROUTES.applications, webUrl).href);
    expect(apps.ok()).toBe(true);
    const applications = ListApplicationsResponseSchema.parse(await apps.json()).applications;
    const saved = applications.find(
      (item) => item.sourceUrl === server.fixtures[0]!.posting.sourceUrl,
    );
    expect(saved).toBeDefined();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(new URL("/dashboard", webUrl).href);
    await expect(page.getByTestId(TEST_IDS.web.dashboard)).toBeVisible();
    await expect(page.getByTestId(dashboardRowTestId(saved!.id))).toContainText(
      "Platform Engineer",
    );
    display = "dashboard";
    await until(60);
    running = false;
    await recording;
    if (captureError) throw captureError;
    await capture();
    const concat = frames
      .map(
        (frame, i) =>
          `file '${frame.path.replaceAll("\\", "/")}'\nduration ${((frames[i + 1]?.time ?? frame.time + 250) - frame.time) / 1000}`,
      )
      .join("\n");
    await writeFile(
      "output/recording.ffconcat",
      `ffconcat version 1.0\n${concat}\nfile '${frames.at(-1)!.path.replaceAll("\\", "/")}'\n`,
    );
    await writeFile(
      "output/assertions.json",
      JSON.stringify(
        {
          scores,
          savedApplicationId: saved!.id,
          recordedAt: new Date().toISOString(),
          frameCount: frames.length,
          capture: "actual posting + standalone native-extension-panel screenshots",
        },
        null,
        2,
      ),
    );
    return resolve("output/recording.ffconcat");
  } finally {
    running = false;
    await recording?.catch(() => {});
    await context.close();
    await server.close();
  }
}
