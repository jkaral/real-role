import { describe, expect, it } from "vitest";
import { analyzeDescription } from "../src";
import { postingAgeSignal } from "../src/signals/age";
import { careersPageSignal } from "../src/signals/careers";
import { hiringActivitySignal } from "../src/signals/hiring";
import { repostHistorySignal } from "../src/signals/repost";
import { specificitySignal } from "../src/signals/specificity";
import {
  MODERATE_DESCRIPTION,
  NOW,
  SPECIFIC_DESCRIPTION,
  VAGUE_DESCRIPTION,
  careers,
  daysAgo,
  input,
  posting,
  role,
} from "./helpers";

describe("posting age", () => {
  it("scores recent postings high and old ones low", () => {
    expect(postingAgeSignal(input({ posting: posting({ postedAt: daysAgo(2) }) })).value).toBe(1);
    expect(
      postingAgeSignal(input({ posting: posting({ postedAt: daysAgo(30) }) })).value,
    ).toBeCloseTo(0.6);
    expect(
      postingAgeSignal(input({ posting: posting({ postedAt: daysAgo(400) }) })).value,
    ).toBeCloseTo(0.05);
  });

  it("is unavailable without a date", () => {
    const s = postingAgeSignal(input({ posting: posting({ postedAt: undefined }) }));
    expect(s.value).toBeNull();
    expect(s.reliability).toBe(0);
  });

  it("falls back to the matched ATS role's date", () => {
    const evidence = careers(true, [role({ postedAt: daysAgo(10) })]);
    const s = postingAgeSignal(
      input({ posting: posting({ postedAt: undefined }), careers: evidence }),
    );
    expect(s.detail).toBe("Posted 10 days ago");
    expect(s.explanation).toContain("careers page");
  });

  it("treats future dates as new and caps passed closing dates", () => {
    expect(postingAgeSignal(input({ posting: posting({ postedAt: daysAgo(-3) }) })).value).toBe(1);
    const closed = postingAgeSignal(
      input({ posting: posting({ postedAt: daysAgo(2), validThrough: daysAgo(1) }) }),
    );
    expect(closed.value).toBe(0.1);
    expect(closed.detail).toContain("closing date has passed");
  });
});

describe("repost history", () => {
  it("is unavailable with no sightings", () => {
    expect(repostHistorySignal(input({ sightings: null })).value).toBeNull();
  });

  it("does not penalize a first sighting but marks it as thin evidence", () => {
    const s = repostHistorySignal(input());
    expect(s.value).toBe(1);
    expect(s.reliability).toBe(0.5);
    expect(s.detail).toBe("First seen today");
  });

  it("does not penalize many sightings in a short window", () => {
    const s = repostHistorySignal(
      input({ sightings: { count: 9, firstSeenAt: daysAgo(5), lastSeenAt: daysAgo(0) } }),
    );
    expect(s.value).toBe(1);
    expect(s.reliability).toBe(1);
  });

  it("penalizes long spans, more so with repeated sightings", () => {
    const once = repostHistorySignal(
      input({ sightings: { count: 1, firstSeenAt: daysAgo(60), lastSeenAt: daysAgo(60) } }),
    );
    const often = repostHistorySignal(
      input({ sightings: { count: 5, firstSeenAt: daysAgo(60), lastSeenAt: daysAgo(0) } }),
    );
    expect(once.value).toBeCloseTo(0.3);
    expect(often.value).toBeCloseTo(0.21);
    expect(often.detail).toBe("Seen 5 times over 60 days");
  });

  it("notes when the posted date is newer than the first sighting", () => {
    const s = repostHistorySignal(
      input({
        posting: posting({ postedAt: daysAgo(3) }),
        sightings: { count: 3, firstSeenAt: daysAgo(45), lastSeenAt: daysAgo(0) },
      }),
    );
    expect(s.explanation).toContain("before its current posted date");
  });
});

describe("careers page", () => {
  it("is unavailable when no board was found", () => {
    expect(careersPageSignal(input()).value).toBeNull();
  });

  it("scores a match by its confidence", () => {
    const s = careersPageSignal(input({ careers: careers(true) }));
    expect(s.value).toBeCloseTo(0.96);
    expect(s.detail).toBe("Listed on the employer's careers page");
    expect(s.explanation).toContain("Greenhouse");
  });

  it("scores a miss low, with neutral wording", () => {
    const s = careersPageSignal(
      input({ careers: careers(false, [role({ title: "Designer" }), role({ id: "2" })]) }),
    );
    expect(s.value).toBe(0.1);
    expect(s.explanation).toContain("2 open roles");
    expect(s.explanation).toContain("may have been filled");
  });

  it("treats an empty board as unknown", () => {
    expect(careersPageSignal(input({ careers: careers(false, []) })).value).toBeNull();
  });
});

describe("company hiring activity", () => {
  it("is unavailable without roles", () => {
    expect(hiringActivitySignal(input()).value).toBeNull();
    expect(hiringActivitySignal(input({ careers: careers(false, []) })).value).toBeNull();
  });

  it("uses the latest role change", () => {
    const recent = hiringActivitySignal(
      input({ careers: careers(false, [role(), role({ id: "2", updatedAt: daysAgo(90) })]) }),
    );
    expect(recent.value).toBe(1);
    expect(recent.detail).toBe("2 open roles; latest change 3 days ago");
    const stale = hiringActivitySignal(
      input({ careers: careers(false, [role({ updatedAt: daysAgo(180) })]) }),
    );
    expect(stale.value).toBeCloseTo(0.3);
  });

  it("falls back to role count without dates", () => {
    const roles = Array.from({ length: 6 }, (_, i) =>
      role({ id: String(i), updatedAt: undefined }),
    );
    expect(hiringActivitySignal(input({ careers: careers(false, roles) })).value).toBe(0.7);
  });
});

describe("description specificity", () => {
  it("finds pay, team, duties and process in a specific description", () => {
    const f = analyzeDescription({ descriptionText: SPECIFIC_DESCRIPTION });
    expect(f).toMatchObject({ salary: true, team: true, process: true, boilerplate: 0 });
    expect(f.duties).toBeGreaterThanOrEqual(5);
    expect(f.score).toBeGreaterThanOrEqual(0.85);
  });

  it("scores boilerplate near zero", () => {
    const f = analyzeDescription({ descriptionText: VAGUE_DESCRIPTION });
    expect(f.boilerplate).toBeGreaterThanOrEqual(4);
    expect(f.score).toBeLessThan(0.1);
    expect(
      specificitySignal(input({ posting: posting({ descriptionText: VAGUE_DESCRIPTION }) })).detail,
    ).toMatch(/^Mostly generic wording/);
  });

  it("scores a moderately specific description in the middle", () => {
    const f = analyzeDescription({ descriptionText: MODERATE_DESCRIPTION });
    expect(f.score).toBeGreaterThan(0.3);
    expect(f.score).toBeLessThan(0.6);
  });

  it("counts structured salary even when the text omits it", () => {
    const f = analyzeDescription({
      descriptionText: "Maintain dashboards.",
      salary: { min: 80000, currency: "USD", period: "year" },
    });
    expect(f.salary).toBe(true);
  });

  it("handles an empty description", () => {
    const s = specificitySignal(input({ posting: posting({ descriptionText: "" }) }));
    expect(s.value).toBe(0);
    expect(s.detail).toBe("No description text");
  });

  it("blends in the LLM rubric and trusts it more", () => {
    const base = specificitySignal(input());
    const blended = specificitySignal(
      input({ rubric: { score: 0.2, reasons: ["Names the team."] } }),
    );
    expect(blended.value).toBeCloseTo(((base.value ?? 0) + 0.2) / 2);
    expect(base.reliability).toBe(0.75);
    expect(blended.reliability).toBe(1);
    expect(blended.explanation).toContain("AI review: Names the team.");
  });
});

describe("all signals", () => {
  it("returns values within [0, 1] at the test clock", () => {
    for (const fn of [
      postingAgeSignal,
      repostHistorySignal,
      careersPageSignal,
      specificitySignal,
      hiringActivitySignal,
    ]) {
      const v = fn(input({ careers: careers(true), now: NOW })).value;
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
