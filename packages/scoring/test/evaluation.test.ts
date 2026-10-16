// Properties the evaluation protocol in docs/scoring-validation.md relies on. Each sweeps one kind of
// evidence while holding the rest fixed. Fictional inputs only; no I/O.
import { describe, expect, it } from "vitest";
import { computeScore, type ScoringInput } from "../src";
import { NOW, careers, daysAgo, input, posting, role } from "./helpers";

const score = (i: ScoringInput) => computeScore(i);
const RANK = { low: 0, medium: 1, high: 2 } as const;

describe("evaluation invariants", () => {
  it("an older posting never scores higher, all else equal", () => {
    let previous = Infinity;
    for (const days of [0, 3, 7, 14, 30, 45, 60, 90, 120, 180, 365]) {
      const s = score(input({ posting: posting({ postedAt: daysAgo(days) }) })).score;
      expect(s).toBeLessThanOrEqual(previous);
      previous = s;
    }
  });

  it("a longer repost history never scores higher, all else equal", () => {
    let previous = Infinity;
    for (const span of [0, 7, 14, 30, 60, 90, 120, 240]) {
      const s = score(
        input({
          sightings: { count: 3, firstSeenAt: daysAgo(span), lastSeenAt: NOW.toISOString() },
        }),
      ).score;
      expect(s).toBeLessThanOrEqual(previous);
      previous = s;
    }
  });

  it("more sightings over the same span never score higher", () => {
    let previous = Infinity;
    for (const count of [1, 2, 3, 4, 6, 10, 50]) {
      const s = score(
        input({ sightings: { count, firstSeenAt: daysAgo(60), lastSeenAt: NOW.toISOString() } }),
      ).score;
      expect(s).toBeLessThanOrEqual(previous);
      previous = s;
    }
  });

  it("being listed on the employer's board never scores lower than being absent from it", () => {
    for (const days of [2, 30, 150]) {
      const base = { posting: posting({ postedAt: daysAgo(days) }) };
      const listed = score(input({ ...base, careers: careers(true) })).score;
      const absent = score(
        input({ ...base, careers: careers(false, [role({ title: "Office Manager" })]) }),
      ).score;
      expect(listed).toBeGreaterThanOrEqual(absent);
    }
  });

  it("missing evidence lowers confidence, never raises it", () => {
    const complete = score(input({ careers: careers(true) }));
    const noCareers = score(input());
    const noDate = score(input({ posting: posting({ postedAt: undefined }) }));
    for (const partial of [noCareers, noDate])
      expect(RANK[partial.confidence]).toBeLessThanOrEqual(RANK[complete.confidence]);
  });

  it("is deterministic: same input, same output", () => {
    const i = input({ careers: careers(true) });
    expect(score(i)).toEqual(score(i));
  });
});
