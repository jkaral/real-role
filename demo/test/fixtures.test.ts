import { describe, expect, it } from "vitest";
import { fingerprint, roleKey, ParsedPostingSchema } from "@real-role/shared";
import { scenarios, seedManifest, fixtureHtml, DAY } from "../src/fixtures";
import { segments, srt } from "../src/timeline";
import { startFixtureServer } from "../src/server";

const now = new Date("2026-10-15T12:00:00Z");
describe("demo inputs", () => {
  it("has three valid fictional postings and a shared fingerprint seed", () => {
    const seed = seedManifest(now);
    expect(seed.fixtures.map((item) => item.expectedBand)).toEqual(["high", "low", "medium"]);
    for (const item of seed.fixtures) {
      expect(ParsedPostingSchema.safeParse(item.posting).success).toBe(true);
      expect(item.fingerprint).toBe(fingerprint(item.posting));
      expect(item.roleKey).toBe(roleKey(item.posting));
      expect(item.posting.sourceUrl).toMatch(/^http:\/\/127\.0\.0\.1:4173\/jobs\//);
    }
    const repost = seed.fixtures[1]!;
    expect(repost.observations).toHaveLength(5);
    expect(
      Date.parse(repost.observations.at(-1)!.observedAt) -
        Date.parse(repost.observations[0]!.observedAt),
    ).toBe(60 * DAY);
  });
  it("embeds matching JSON-LD without executable description content", () => {
    for (const scenario of scenarios(now)) {
      const html = fixtureHtml(scenario);
      const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      expect(JSON.parse(json!).title).toBe(scenario.posting.title);
      expect(html).toContain("Fictional demonstration company");
    }
  });
  it("serves only the local fixtures and rejects other paths", async () => {
    const server = await startFixtureServer(now, 0);
    try {
      const response = await fetch(`${server.origin}/jobs/fresh`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Bramblecrest Analytics");
      expect((await fetch(`${server.origin}/../secret`)).status).toBe(404);
    } finally {
      await server.close();
    }
  });
  it("keeps captions and narration aligned to a 72-second timeline", () => {
    expect(segments.at(-1)?.end).toBe(72);
    segments.slice(1).forEach((segment, i) => expect(segment.start).toBe(segments[i]!.end));
    expect(srt()).toContain("00:01:04,000 --> 00:01:12,000");
  });
});
