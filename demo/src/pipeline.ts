import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios, seedManifest, fixtureHtml } from "./fixtures";
import { srt } from "./timeline";
import { startFixtureServer } from "./server";
import { assemble, narrate } from "./media";
import { record } from "./record";
import { startDemoEnvironment } from "./environment";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const now = new Date(process.env.DEMO_NOW ?? new Date().toISOString());
if (!Number.isFinite(now.getTime())) throw new Error("DEMO_NOW must be an ISO timestamp.");
await mkdir("output/fixtures", { recursive: true });
const mode = process.argv[2] ?? "video";
if (mode !== "assemble")
  await writeFile("output/seed.json", JSON.stringify(seedManifest(now), null, 2) + "\n");
await writeFile("output/captions.srt", srt());
for (const scenario of mode === "assemble" ? [] : scenarios(now))
  await writeFile(`output/fixtures/${scenario.slug}.html`, fixtureHtml(scenario));
if (mode === "serve") {
  const fixtures = await startFixtureServer(now, Number(process.env.RR_E2E_FIXTURE_PORT ?? "4173"));
  console.log(`Fictional fixture pages: ${fixtures.origin}/jobs/fresh (also /reposted and /vague)`);
} else if (mode === "prepare") {
  console.log(
    "Prepared three fictional pages, observation seed manifest and timed captions in demo/output.",
  );
} else if (mode === "video" || mode === "assemble") {
  const handoff = await readFile(resolve("../docs/HANDOFF.md"), "utf8");
  const live = [...handoff.matchAll(/web app live at (https:\/\/[^\s<>]+)/gi)].at(-1)?.[1];
  if (!handoff.includes("extension build ready for demo") || !live)
    throw new Error(
      "Final recording waits for Claude's handoff: extension build ready for demo; web app live at <URL>.",
    );
  // Seeding is owned by apps/web; fail if the owner hasn't supplied the integration hook.
  const webPackage = JSON.parse(await readFile("../apps/web/package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (!webPackage.scripts?.["db:seed-demo"])
    throw new Error(
      "Waiting for apps/web db:seed-demo integration. See demo/README.md for seed manifest format.",
    );
  const audio = await narrate();
  if (mode === "assemble")
    await assemble(resolve("output/recording.ffconcat"), audio, new URL(live).href);
  else {
    const environment = await startDemoEnvironment(now);
    try {
      const recording = await record(now, environment.webUrl);
      await assemble(recording, audio, new URL(live).href);
    } finally {
      await environment.stop();
    }
  }
  console.log("Demo video ready: demo/output/real-role-demo.mp4");
} else throw new Error(`Unknown demo mode: ${mode}`);
