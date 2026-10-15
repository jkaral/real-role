/** Origin of the Real Role web app and API (WXT_API_BASE at build time). */
export const API_BASE: string = new URL(
  import.meta.env.WXT_API_BASE ?? "https://real-role.vercel.app",
).origin;

/** Demo/e2e builds (WXT_DEMO=1) also run on loopback fixture pages. */
export const DEMO_BUILD: boolean = import.meta.env.WXT_DEMO === "1";

/**
 * Job boards where the content script runs automatically. Anywhere else, nothing runs until the
 * user clicks the toolbar icon (A2: read only what the user is viewing).
 */
export const AUTO_MATCHES = [
  "https://boards.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://jobs.lever.co/*",
  "https://jobs.eu.lever.co/*",
  "https://jobs.ashbyhq.com/*",
  "https://*.myworkdayjobs.com/*",
  "https://wellfound.com/jobs/*",
  "https://*.indeed.com/viewjob*",
  "https://www.linkedin.com/jobs/view/*",
];

export const DEMO_MATCHES = ["http://127.0.0.1/*"];
