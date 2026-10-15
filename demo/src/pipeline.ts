import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios, seedManifest, fixtureHtml } from "./fixtures";
import { srt } from "./timeline";
import { startFixtureServer } from "./server";
import { assemble, narrate } from "./media";
import { record } from "./record";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const now = new Date(process.env.DEMO_NOW ?? new Date().toISOString());
if (!Number.isFinite(now.getTime())) throw new Error("DEMO_NOW must be an ISO timestamp.");
await mkdir("output/fixtures", { recursive: true });
const mode = process.argv[2] ?? "video";
await writeFile("output/seed.json", JSON.stringify(seedManifest(now), null, 2) + "\n");
await writeFile("output/captions.srt", srt());
for (const scenario of scenarios(now))
  await writeFile(`output/fixtures/${scenario.slug}.html`, fixtureHtml(scenario));
if (mode === "serve") {
  await startFixtureServer(now);
  console.log(
    "Fictional fixture pages: http://127.0.0.1:4173/jobs/fresh (also /reposted and /vague)",
  );
} else if (mode === "prepare") {
  console.log(
    "Prepared three fictional pages, observation seed manifest and timed captions in demo/output.",
  );
} else if (mode === "video") {
  const handoff = await readFile(resolve("../docs/HANDOFF.md"), "utf8");
  const live = [...handoff.matchAll(/web app live at (https:\/\/[^\s<>]+)/gi)].at(-1)?.[1];
  if (!handoff.includes("extension build ready for demo") || !live)
    throw new Error(
      "Final recording waits for Claude's handoff: extension build ready for demo; web app live at <URL>.",
    );
  const webUrl = new URL(process.env.DEMO_WEB_URL ?? live);
  if (!["http:", "https:"].includes(webUrl.protocol))
    throw new Error("DEMO_WEB_URL must be an HTTP(S) URL.");
  // Seeding is owned by apps/web; fail if the owner hasn't supplied the integration hook.
  const webPackage = JSON.parse(await readFile("../apps/web/package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (!webPackage.scripts?.["db:seed-demo"])
    throw new Error(
      "Waiting for apps/web db:seed-demo integration. See demo/README.md for seed manifest format.",
    );
  const { run } = await import("./media");
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  if (process.platform === "win32") {
    // cmd is used only to invoke the fixed pnpm command; the manifest path is fixed too.
    await run("cmd.exe", [
      "/d",
      "/s",
      "/c",
      `${pnpm} --dir .. --filter @real-role/web db:seed-demo demo/output/seed.json`,
    ]);
  } else
    await run(pnpm, [
      "--dir",
      "..",
      "--filter",
      "@real-role/web",
      "db:seed-demo",
      "demo/output/seed.json",
    ]);
  const recording = await record(now, webUrl.href);
  const audio = await narrate();
  await assemble(recording, audio, new URL(live).href);
  console.log("Demo video ready: demo/output/real-role-demo.mp4");
} else throw new Error(`Unknown demo mode: ${mode}`);
