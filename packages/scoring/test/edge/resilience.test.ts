import { describe, expect, it } from "vitest";
import { ScoreResultSchema, type ScoreResult, type SignalId } from "@real-role/shared";
import { computeScore, parseRubricResponse } from "../../src";
import { careers, daysAgo, input, NOW, posting, role } from "../helpers";

const signal = (result: ScoreResult, id: SignalId) =>
  result.signals.find((item) => item.id === id)!;
function valid(result: ScoreResult) {
  expect(ScoreResultSchema.safeParse(result).success).toBe(true);
  expect(result.signals.reduce((sum, item) => sum + item.impact, 0)).toBe(result.score);
  for (const item of result.signals) expect(item.impact).toBeLessThanOrEqual(item.maxImpact);
}

describe("missing and malformed dates", () => {
  it.each([undefined, "", "not-a-date"])("omits unavailable age evidence (%s)", (postedAt) => {
    const result = computeScore(input({ posting: posting({ postedAt }), sightings: null }));
    valid(result);
    expect(signal(result, "posting_age")).toMatchObject({
      available: false,
      value: null,
      impact: 0,
      maxImpact: 0,
    });
    expect(result.confidence).toBe("low");
    expect(result.signals.reduce((sum, item) => sum + item.maxImpact, 0)).toBe(100);
  });
  it("uses the matched ATS publication date when the page date is unusable", () => {
    const result = computeScore(
      input({
        posting: posting({ postedAt: "invalid" }),
        careers: careers(true, [role({ postedAt: daysAgo(2) })]),
      }),
    );
    expect(signal(result, "posting_age").value).toBe(1);
    expect(signal(result, "posting_age").explanation).toContain("date from the employer");
    valid(result);
  });
  it("does not substitute the date of an unrelated ATS role", () => {
    const result = computeScore(
      input({
        posting: posting({ postedAt: undefined }),
        careers: careers(false, [role({ postedAt: daysAgo(2) })]),
      }),
    );
    expect(signal(result, "posting_age").available).toBe(false);
    valid(result);
  });
});

describe("unknown ATS and unavailable LLM", () => {
  it("treats null and omitted careers evidence identically", () => {
    const omitted = computeScore(input());
    const unknown = computeScore(input({ careers: null }));
    expect(unknown).toEqual(omitted);
    for (const id of ["careers_page_match", "company_hiring_activity"] as const) {
      expect(signal(unknown, id)).toMatchObject({ available: false, impact: 0, maxImpact: 0 });
    }
    expect(unknown.confidence).not.toBe("high");
  });
  it.each([null, "not json", { score: 2, reasons: [] }, { score: 0.5, reasons: [""] }])(
    "falls back to the same heuristics for rejected rubric %j",
    (raw) => {
      const rubric = parseRubricResponse(raw);
      expect(rubric).toBeNull();
      const result = computeScore(input({ rubric }));
      expect(result).toEqual(computeScore(input()));
      expect(result.usedLlm).toBe(false);
      valid(result);
    },
  );
});

describe("description boundaries", () => {
  it.each([
    "",
    " \t\n ",
    "<div><broken",
    "\u0000\u0001\uFFFD",
    "招聘 — équipe — فريق",
    "own ".repeat(12500),
  ])("keeps valid explainable output for string input %#", (descriptionText) => {
    const result = computeScore(input({ posting: posting({ descriptionText }) }));
    valid(result);
    expect(result.usedLlm).toBe(false);
    expect(signal(result, "description_specificity").value).toBeGreaterThanOrEqual(0);
  });
  it("is deterministic when interleaving very different descriptions", () => {
    const original = computeScore(input());
    computeScore(input({ posting: posting({ descriptionText: "other duties as assigned" }) }));
    expect(computeScore(input())).toEqual(original);
  });
});

describe("time zones and closing boundaries", () => {
  it.each([
    ["2026-03-08T01:30:00-05:00", "2026-03-08T06:30:00Z"],
    ["2026-11-01T01:30:00-04:00", "2026-11-01T05:30:00Z"],
    ["2026-10-15T00:30:00+14:00", "2026-10-14T10:30:00Z"],
  ])("scores equivalent instants equally (%s)", (offset, utc) => {
    const now = new Date(Date.parse(utc) + 30 * 86400000);
    expect(computeScore(input({ now, posting: posting({ postedAt: offset }) }))).toEqual(
      computeScore(input({ now, posting: posting({ postedAt: utc }) })),
    );
  });
  it("distinguishes the two repeated fall-back clock hours", () => {
    const now = new Date("2026-11-02T05:30:00Z");
    const first = computeScore(
      input({ now, posting: posting({ postedAt: "2026-10-02T01:30:00-04:00" }) }),
    );
    const second = computeScore(
      input({ now, posting: posting({ postedAt: "2026-10-02T01:30:00-05:00" }) }),
    );
    expect(signal(second, "posting_age").value).toBeGreaterThan(
      signal(first, "posting_age").value!,
    );
  });
  it("expires one millisecond after the listed closing instant, including an offset", () => {
    const p = posting({ validThrough: "2026-10-15T08:00:00-04:00" });
    expect(signal(computeScore(input({ posting: p })), "posting_age").value).toBe(1);
    const expired = computeScore(input({ posting: p, now: new Date(NOW.getTime() + 1) }));
    expect(signal(expired, "posting_age").value).toBeLessThanOrEqual(0.1);
    valid(expired);
  });
});

describe("extreme repost history", () => {
  it.each([1_000_000, Number.MAX_SAFE_INTEGER])(
    "keeps count %s bounded without losing point accounting",
    (count) => {
      const result = computeScore(
        input({ sightings: { count, firstSeenAt: daysAgo(36500), lastSeenAt: NOW.toISOString() } }),
      );
      valid(result);
      expect(signal(result, "repost_history").value).toBeLessThanOrEqual(0.1);
      expect(signal(result, "repost_history").detail).toContain(String(count));
    },
  );
  it("does not mistake many observations today for long-running reposts", () => {
    const result = computeScore(
      input({
        sightings: {
          count: 1_000_000,
          firstSeenAt: NOW.toISOString(),
          lastSeenAt: NOW.toISOString(),
        },
      }),
    );
    expect(signal(result, "repost_history").value).toBe(1);
    valid(result);
  });
});
