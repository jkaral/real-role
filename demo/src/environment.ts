import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export function pnpm(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const executable = process.env.npm_execpath;
  if (!executable || !/\.[cm]?js$/.test(executable))
    throw new Error("Run the pipeline through pnpm demo:video.");
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [executable, "--dir", "..", ...args], {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? done() : reject(new Error(`pnpm ${args.join(" ")} failed (${code})`)),
    );
  });
}

export async function startDemoEnvironment(now: Date) {
  const runDir = resolve("output/runs", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(runDir, { recursive: true });
  const database = `pglite:${resolve(runDir, "database")}`;
  const env = {
    ...process.env,
    DATABASE_URL: database,
    DATABASE_URL_UNPOOLED: database,
    AUTH_SECRET: "fictional-local-demo-only",
    AUTH_TRUST_HOST: "true",
    ALLOW_DEMO_AUTH: "1",
    ALLOW_DEMO_SEED: "1",
    ANTHROPIC_API_KEY: "",
    VERCEL_ENV: "development",
    DEMO_NOW: now.toISOString(),
  };
  await pnpm(["--filter", "@real-role/web", "build"], env);
  await pnpm(["--filter", "@real-role/extension", "build:demo"], env);
  await pnpm(["--filter", "@real-role/web", "db:migrate"], env);
  await pnpm(["--filter", "@real-role/web", "db:seed-demo", resolve("output/seed.json")], env);
  // Fail if the fixed demo port is occupied; never reuse an unknown server/database.
  const { createServer } = await import("node:net");
  const portCheck = createServer();
  await new Promise<void>((done, reject) => {
    portCheck.once("error", reject);
    portCheck.listen(3100, () => portCheck.close(() => done()));
  });
  const log = createWriteStream(resolve(runDir, "web.log"));
  const web: ChildProcess = spawn(
    process.execPath,
    [
      resolve("../apps/web/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { cwd: resolve("../apps/web"), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  web.stdout?.pipe(log);
  web.stderr?.pipe(log);
  let launchError: Error | undefined;
  web.once("error", (error) => {
    launchError = error;
  });
  const stop = async () => {
    if (web.exitCode === null && web.pid) {
      web.kill();
      await new Promise<void>((done) => web.once("exit", () => done()));
    }
    log.end();
  };
  try {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (web.exitCode !== null) throw new Error(`Local web server exited; see ${runDir}/web.log`);
      try {
        if ((await fetch("http://localhost:3100", { signal: AbortSignal.timeout(2000) })).ok)
          return { webUrl: "http://localhost:3100", runDir, stop };
      } catch {
        /* Wait for local startup. */
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    throw new Error(`Local web startup timed out; see ${runDir}/web.log`);
  } catch (error) {
    await stop();
    throw error;
  }
}
