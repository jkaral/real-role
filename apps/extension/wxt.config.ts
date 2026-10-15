import { defineConfig } from "wxt";

// Production talks to the live web app. `build:demo` points at a local web app and also matches
// the loopback fixture pages used by the demo and the end-to-end test.
const API_BASE = process.env.WXT_API_BASE ?? "https://real-role.vercel.app";
const DEMO = process.env.WXT_DEMO === "1";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  zip: { artifactTemplate: "real-role-extension-{{version}}-{{browser}}.zip" },
  manifest: {
    name: "Real Role: job posting freshness",
    short_name: "Real Role",
    description:
      "See how likely a job posting is to be a real, active opening, with the signals behind the score.",
    permissions: ["sidePanel", "storage", "activeTab", "scripting"],
    // Match patterns take no port; the host alone covers e.g. localhost:3100.
    host_permissions: [
      `${new URL(API_BASE).protocol}//${new URL(API_BASE).hostname}/*`,
      ...(DEMO ? ["http://127.0.0.1/*"] : []),
    ],
    action: { default_title: "Real Role: check this posting" },
    side_panel: { default_path: "sidepanel.html" },
  },
});
