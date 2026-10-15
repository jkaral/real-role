import { defineConfig } from "@playwright/test";

// End-to-end test of the main flow with the real extension, web app and API (separate from the
// demo recording). Run with `pnpm --filter @real-role/extension e2e`.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
});
