import type { ParsedPosting, ScoreResponse } from "@real-role/shared";
import { describe, expect, it } from "vitest";
import { ApiFailure, findTracked, saveApplication, scorePosting } from "../src/lib/api";
import { AUTO_MATCHES } from "../src/lib/config";
import { BAND_COLORS, badgeFor, tabKey } from "../src/lib/state";

// Fictional employer only (A2).
const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  descriptionText: "Own deployment pipelines.",
  sourceUrl: "https://jobs.lever.co/bramblecrest/42",
  source: "lever",
  parsedBy: "lever",
};

const response: ScoreResponse = {
  postingId: "p1",
  fingerprint: "fp1_0000000000000000",
  posting,
  result: {
    score: 82,
    band: "high",
    confidence: "medium",
    signals: [],
    computedAt: "2026-10-15T00:00:00.000Z",
    engineVersion: "scoring-1",
    usedLlm: false,
  },
};

function fakeFetch(
  status: number,
  body: unknown,
  seen: { init?: RequestInit; url?: string } = {},
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.init = init;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("api client", () => {
  it("sends the parsed posting with credentials and validates the reply", async () => {
    const seen: { init?: RequestInit; url?: string } = {};
    const data = await scorePosting(posting, fakeFetch(200, response, seen));
    expect(data.result.score).toBe(82);
    expect(seen.url).toBe("https://real-role.vercel.app/api/score");
    expect(seen.init?.credentials).toBe("include");
    expect(JSON.parse(String(seen.init?.body))).toEqual({ kind: "parsed", posting });
  });

  it("surfaces the API's error message", async () => {
    const err = await scorePosting(
      posting,
      fakeFetch(429, {
        error: { code: "rate_limited", message: "Too many requests. Try again shortly." },
      }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiFailure);
    expect((err as ApiFailure).message).toBe("Too many requests. Try again shortly.");
  });

  it("reports network failures and malformed replies clearly", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(scorePosting(posting, offline)).rejects.toMatchObject({ code: "network" });
    await expect(scorePosting(posting, fakeFetch(200, { nope: true }))).rejects.toThrow();
  });

  it("asks for sign-in on 401 when saving", async () => {
    await expect(
      saveApplication(
        "p1",
        fakeFetch(401, { error: { code: "unauthorized", message: "Sign in" } }),
      ),
    ).resolves.toEqual({ status: "signin" });
  });
});

describe("toolbar badge", () => {
  it("shows the score in the band colour, and nothing when there's no posting", () => {
    expect(badgeFor({ status: "ready", url: "x", data: response })).toEqual({
      text: "82",
      color: BAND_COLORS.high,
    });
    expect(badgeFor({ status: "loading", url: "x" }).text).toBe("…");
    expect(badgeFor({ status: "error", url: "x", message: "m" }).text).toBe("!");
    expect(badgeFor({ status: "not-a-posting", url: "x" }).text).toBe("");
    expect(badgeFor(undefined).text).toBe("");
    expect(tabKey(7)).toBe("tab:7");
  });
});

describe("automatic matches", () => {
  it("are https job-board pages only, never all sites", () => {
    for (const m of AUTO_MATCHES) {
      expect(m.startsWith("https://")).toBe(true);
      expect(m).not.toContain("<all_urls>");
      expect(m).not.toBe("https://*/*");
    }
  });
});

describe("findTracked", () => {
  const app = {
    id: "a1",
    postingId: "p1",
    title: "Platform Engineer",
    company: "Bramblecrest Analytics",
    sourceUrl: posting.sourceUrl,
    status: "applied",
    savedAt: "2026-10-10T00:00:00.000Z",
    appliedAt: "2026-10-11T00:00:00.000Z",
    followUpAt: "2026-10-18T00:00:00.000Z",
    statusChangedAt: "2026-10-11T00:00:00.000Z",
    notes: null,
    scoreAtSave: 82,
    confidenceAtSave: "medium",
  };

  it("returns the user's application for this posting", async () => {
    const seen: { init?: RequestInit } = {};
    const found = await findTracked("p1", fakeFetch(200, { application: app }, seen));
    expect(found?.id).toBe("a1");
    expect(seen.init?.credentials).toBe("include");
  });

  it("treats other postings, signed-out and network errors as not tracked", async () => {
    expect(await findTracked("p2", fakeFetch(200, { application: app }))).toBeNull();
    expect(await findTracked("p1", fakeFetch(200, { application: null }))).toBeNull();
    expect(await findTracked("p1", fakeFetch(401, { error: {} }))).toBeNull();
    const offline = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await findTracked("p1", offline)).toBeNull();
  });
});
