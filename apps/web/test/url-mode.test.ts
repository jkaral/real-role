import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePostingHtml } from "../src/server/score-service";

const fixtures = new URL("../../../packages/parsers/test/fixtures/", import.meta.url);

describe("URL mode parsing", () => {
  // Vercel's function runtime loads externals with require() and no require(esm) support;
  // jsdom 30's dependency chain needs it, which broke URL mode in production.
  it("loads jsdom with require() and require(esm) disabled", () => {
    const run = spawnSync(
      process.execPath,
      ["--no-experimental-require-module", "-e", "require('jsdom')"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" },
    );
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("parses the hosted-board and JSON-LD fixtures, including description text", async () => {
    const cases: [string, string][] = [
      ["generic", "https://bramblecrest.example/jobs/42"],
      ["greenhouse", "https://job-boards.greenhouse.io/bramblecrest/jobs/42"],
      ["lever", "https://jobs.lever.co/northwind/42"],
      ["ashby", "https://jobs.ashbyhq.com/mapleglass/42"],
    ];
    for (const [name, url] of cases) {
      const posting = await parsePostingHtml(
        readFileSync(new URL(`${name}.html`, fixtures), "utf8"),
        url,
      );
      expect(posting, name).not.toBeNull();
      expect(posting?.descriptionText.length, name).toBeGreaterThan(20);
    }
  });

  it("returns null for a page without a posting", async () => {
    expect(await parsePostingHtml("<h1>Example Domain</h1>", "https://example.com/")).toBeNull();
  });
});
