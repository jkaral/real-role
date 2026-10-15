import { ScoreResultSchema, SIGNAL_IDS, type ScoreResult } from "@real-role/shared";
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, bandFor, computeScore, type ScoringInput } from "../src";
import {
  MODERATE_DESCRIPTION,
  NOW,
  VAGUE_DESCRIPTION,
  careers,
  daysAgo,
  input,
  posting,
  role,
} from "./helpers";

function expectInvariants(result: ScoreResult) {
  expect(ScoreResultSchema.safeParse(result).success).toBe(true);
  expect(result.signals.map((s) => s.id)).toEqual([...SIGNAL_IDS]);
  expect(result.signals.reduce((sum, s) => sum + s.impact, 0)).toBe(result.score);
  for (const s of result.signals) {
    expect(Number.isInteger(s.impact)).toBe(true);
    expect(s.impact).toBeLessThanOrEqual(s.maxImpact);
    if (!s.available) {
      expect(s.value).toBeNull();
      expect(s.impact).toBe(0);
      expect(s.maxImpact).toBe(0);
    }
  }
  const maxTotal = result.signals.reduce((sum, s) => sum + s.maxImpact, 0);
  expect(maxTotal === 100 || maxTotal === 0).toBe(true);
}

// Mirrors the three fictional demo fixtures (demo/src/fixtures.ts): no ATS evidence.
const demo = {
  fresh: input({
    posting: posting({
      postedAt: daysAgo(2),
      salary: { min: 110000, max: 140000, currency: "CAD", period: "year" },
    }),
  }),
  reposted: input({
    posting: posting({
      title: "Data Analyst",
      company: "Northwind Lumen",
      postedAt: daysAgo(150),
      descriptionText: `${MODERATE_DESCRIPTION} This posting has been observed repeatedly with identical responsibilities.`,
    }),
    sightings: { count: 5, firstSeenAt: daysAgo(60), lastSeenAt: daysAgo(0) },
  }),
  vague: input({
    posting: posting({
      title: "Operations Associate",
      company: "Mapleglass Systems",
      postedAt: daysAgo(30),
      descriptionText: VAGUE_DESCRIPTION,
    }),
  }),
};

describe("demo fixture bands", () => {
  it("fresh and specific → high", () => {
    const r = computeScore(demo.fresh);
    expectInvariants(r);
    expect(r.band).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("stale and reposted → low", () => {
    const r = computeScore(demo.reposted);
    expectInvariants(r);
    expect(r.band).toBe("low");
    expect(r.score).toBeLessThan(30);
  });

  it("vague → medium", () => {
    const r = computeScore(demo.vague);
    expectInvariants(r);
    expect(r.band).toBe("medium");
  });

  it("keeps the same bands when an LLM rubric agrees with the heuristics", () => {
    expect(computeScore({ ...demo.fresh, rubric: { score: 0.9, reasons: [] } }).band).toBe("high");
    expect(computeScore({ ...demo.reposted, rubric: { score: 0.5, reasons: [] } }).band).toBe(
      "low",
    );
    expect(computeScore({ ...demo.vague, rubric: { score: 0.1, reasons: [] } }).band).toBe(
      "medium",
    );
  });

  it("reports medium confidence without ATS evidence", () => {
    for (const fixture of Object.values(demo)) {
      expect(computeScore(fixture).confidence).toBe("medium");
    }
  });
});

describe("missing data lowers confidence, not the score", () => {
  it("renormalizes over available signals", () => {
    // All available signals perfect → 100 even though careers and hiring are unknown.
    const r = computeScore(
      input({
        posting: posting({ salary: { min: 1, max: 2 } }),
        rubric: { score: 1, reasons: [] },
      }),
    );
    const available = r.signals.filter((s) => s.available).map((s) => s.id);
    expect(available).toEqual(["posting_age", "repost_history", "description_specificity"]);
    expect(r.score).toBeGreaterThanOrEqual(95);
  });

  it("gives high confidence with full evidence and low with only a description", () => {
    const full = computeScore(
      input({
        careers: careers(true),
        sightings: { count: 2, firstSeenAt: daysAgo(3), lastSeenAt: daysAgo(0) },
        rubric: { score: 0.9, reasons: [] },
      }),
    );
    expect(full.confidence).toBe("high");
    expectInvariants(full);

    const bare = computeScore(
      input({ posting: posting({ postedAt: undefined }), sightings: null }),
    );
    expect(bare.signals.filter((s) => s.available)).toHaveLength(1);
    expect(bare.confidence).toBe("low");
    expectInvariants(bare);
  });
});

describe("careers evidence moves the score", () => {
  it("a careers-page miss lowers the score", () => {
    const listed = computeScore(input({ careers: careers(true) }));
    const missing = computeScore(
      input({ careers: careers(false, [role({ id: "9", title: "Accountant" })]) }),
    );
    expect(missing.score).toBeLessThan(listed.score);
    expect(missing.signals.find((s) => s.id === "careers_page_match")?.detail).toBe(
      "Not found on the employer's careers page",
    );
  });
});

describe("weights", () => {
  it("honours overrides from config", () => {
    const base = computeScore(demo.vague);
    const ageOnly = computeScore(demo.vague, {
      weights: { repost_history: 0, description_specificity: 0 },
    });
    expect(ageOnly.score).toBe(60); // 30 days old → 0.6
    expect(ageOnly.score).not.toBe(base.score);
    expectInvariants(ageOnly);
  });

  it("ignores invalid overrides", () => {
    const r = computeScore(demo.fresh, {
      weights: { posting_age: -5, repost_history: Number.NaN },
    });
    expect(r.score).toBe(computeScore(demo.fresh).score);
  });
});

describe("output", () => {
  it("is deterministic and stamped", () => {
    const a = computeScore(demo.fresh);
    expect(computeScore(demo.fresh)).toEqual(a);
    expect(a.computedAt).toBe(NOW.toISOString());
    expect(a.engineVersion).toBe(ENGINE_VERSION);
    expect(a.usedLlm).toBe(false);
    expect(computeScore({ ...demo.fresh, rubric: { score: 1, reasons: [] } }).usedLlm).toBe(true);
  });

  it("maps scores to bands", () => {
    expect(bandFor(70)).toBe("high");
    expect(bandFor(69)).toBe("medium");
    expect(bandFor(40)).toBe("medium");
    expect(bandFor(39)).toBe("low");
  });
});

describe("invariants over many random inputs", () => {
  // Small deterministic PRNG so failures are reproducible.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;

  it("holds for 500 combinations", () => {
    for (let i = 0; i < 500; i++) {
      const roles = Array.from({ length: Math.floor(rand() * 4) }, (_, j) =>
        role({ id: String(j), updatedAt: rand() < 0.3 ? undefined : daysAgo(rand() * 300) }),
      );
      const scenario: ScoringInput = input({
        posting: posting({
          postedAt: rand() < 0.2 ? undefined : daysAgo(rand() * 400 - 5),
          descriptionText: pick([VAGUE_DESCRIPTION, MODERATE_DESCRIPTION, "", "Short."]),
        }),
        sightings:
          rand() < 0.2
            ? null
            : {
                count: Math.floor(rand() * 10),
                firstSeenAt: daysAgo(rand() * 200),
                lastSeenAt: daysAgo(0),
              },
        careers: rand() < 0.4 ? null : careers(rand() < 0.5, roles),
        rubric: rand() < 0.5 ? null : { score: rand(), reasons: [] },
      });
      const weights =
        rand() < 0.3 ? { posting_age: rand() * 50, careers_page_match: 0 } : undefined;
      expectInvariants(computeScore(scenario, { weights }));
    }
  });
});
