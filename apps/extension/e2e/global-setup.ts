import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// Read-only use of Codex's fixture generator: the seed and the served pages share one clock.
import { seedManifest } from "../../../demo/src/fixtures";
import { FIXTURES_URL, PGLITE_DIR, REPO, WEB_URL } from "./env";

const isWin = process.platform === "win32";
const pnpm = isWin ? "pnpm.cmd" : "pnpm";

function run(args: string[], env: NodeJS.ProcessEnv): void {
  const r = spawnSync(pnpm, args, { cwd: REPO, env, stdio: "inherit", shell: isWin });
  if (r.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed`);
}

function start(args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(pnpm, args, { cwd: REPO, env, stdio: "ignore", shell: isWin, detached: !isWin });
}

async function waitFor(url: string, ms = 90_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stop(child: ChildProcess): void {
  if (!child.pid) return;
  if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGTERM");
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const now = new Date();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `pglite:${PGLITE_DIR}`,
    AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
    AUTH_TRUST_HOST: "true",
    ALLOW_DEMO_AUTH: "1",
    ALLOW_DEMO_SEED: "1",
    DEMO_NOW: now.toISOString(),
    ANTHROPIC_API_KEY: "",
  };

  // Fresh local database with the demo's fictional observations.
  rmSync(PGLITE_DIR, { recursive: true, force: true });
  run(["--filter", "@real-role/web", "db:migrate"], env);
  const manifest = join(REPO, "apps", "web", ".pglite-e2e.seed.json");
  writeFileSync(manifest, JSON.stringify(seedManifest(now)));
  run(["--filter", "@real-role/web", "db:seed-demo", manifest], env);
  rmSync(manifest, { force: true });

  const web = start(["--filter", "@real-role/web", "start", "--port", "3100"], env);
  const fixtures = start(["--filter", "@real-role/demo", "demo:serve"], env);
  await Promise.all([waitFor(`${WEB_URL}/`), waitFor(`${FIXTURES_URL}/jobs/fresh`)]);

  return async () => {
    stop(web);
    stop(fixtures);
  };
}
