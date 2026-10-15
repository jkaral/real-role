import { describe, expect, it } from "vitest";
import { formatDays, interpolate, joinAnd, roundToTarget } from "../src/util";

describe("interpolate", () => {
  const curve = [
    [0, 1],
    [10, 0.5],
    [20, 0],
  ] as const;

  it("is linear between points and flat beyond the ends", () => {
    expect(interpolate(curve, -5)).toBe(1);
    expect(interpolate(curve, 5)).toBeCloseTo(0.75);
    expect(interpolate(curve, 15)).toBeCloseTo(0.25);
    expect(interpolate(curve, 99)).toBe(0);
  });
});

describe("roundToTarget", () => {
  it("rounds to integers that sum exactly to the target", () => {
    const out = roundToTarget([33.3, 33.3, 33.4], 100);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
    expect(out).toEqual([33, 33, 34]);
  });

  it("never exceeds caps", () => {
    const out = roundToTarget([24.6, 10.6], 35, [24, 11]);
    expect(out[0]).toBeLessThanOrEqual(24);
    expect(out[1]).toBeLessThanOrEqual(11);
  });

  it("handles all zeros", () => {
    expect(roundToTarget([0, 0], 0)).toEqual([0, 0]);
  });
});

describe("text helpers", () => {
  it("formats days and lists", () => {
    expect(formatDays(0.2)).toBe("today");
    expect(formatDays(1)).toBe("1 day ago");
    expect(formatDays(41.4)).toBe("41 days ago");
    expect(joinAnd(["a"])).toBe("a");
    expect(joinAnd(["a", "b", "c"])).toBe("a, b and c");
  });
});
