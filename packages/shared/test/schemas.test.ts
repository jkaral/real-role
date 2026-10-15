import { describe, expect, it } from "vitest";
import {
  API_ROUTES,
  CreateApplicationRequestSchema,
  ParsedPostingSchema,
  ScoreRequestSchema,
  ScoreResultSchema,
  SIGNAL_IDS,
  defaultFollowUpAt,
  isFollowUpDue,
  signalRowTestId,
  type ParsedPosting,
  type ScoreResult,
} from "../src";

// Fictional company only (A2).
const posting: ParsedPosting = {
  title: "Data Analyst",
  company: "Bramblecrest Analytics",
  companyDomain: "bramblecrest.example",
  location: "Remote, Canada",
  remote: true,
  postedAt: "2026-10-01T12:00:00Z",
  descriptionText: "Build dashboards for the finance team. Salary CA$80,000–95,000.",
  salary: { min: 80000, max: 95000, currency: "CAD", period: "year" },
  sourceUrl: "http://localhost:4173/jobs/bramblecrest-data-analyst",
  source: "generic",
  parsedBy: "generic-jsonld",
};

describe("ParsedPostingSchema", () => {
  it("round-trips a valid posting", () => {
    expect(ParsedPostingSchema.parse(posting)).toEqual(posting);
  });

  it("rejects an empty title and non-ISO dates", () => {
    expect(ParsedPostingSchema.safeParse({ ...posting, title: "  " }).success).toBe(false);
    expect(ParsedPostingSchema.safeParse({ ...posting, postedAt: "Oct 1" }).success).toBe(false);
  });
});

describe("ScoreRequestSchema", () => {
  it("accepts each kind", () => {
    expect(ScoreRequestSchema.safeParse({ kind: "parsed", posting }).success).toBe(true);
    expect(
      ScoreRequestSchema.safeParse({ kind: "url", url: "https://jobs.example/123" }).success,
    ).toBe(true);
    expect(ScoreRequestSchema.safeParse({ kind: "text", text: "x".repeat(60) }).success).toBe(true);
  });

  it("rejects unknown kinds and too-short text", () => {
    expect(ScoreRequestSchema.safeParse({ kind: "crawl", url: "x" }).success).toBe(false);
    expect(ScoreRequestSchema.safeParse({ kind: "text", text: "short" }).success).toBe(false);
  });
});

describe("ScoreResultSchema", () => {
  it("accepts a result whose impacts sum to the score", () => {
    const result: ScoreResult = {
      score: 72,
      band: "high",
      confidence: "medium",
      computedAt: "2026-10-14T00:00:00.000Z",
      engineVersion: "scoring-1",
      usedLlm: false,
      signals: SIGNAL_IDS.map((id, i) => ({
        id,
        label: id,
        value: i === 4 ? null : 0.8,
        impact: i === 4 ? 0 : 18,
        maxImpact: i === 4 ? 0 : 22.5,
        available: i !== 4,
        detail: "",
        explanation: "",
      })),
    };
    expect(ScoreResultSchema.parse(result).signals).toHaveLength(5);
    expect(result.signals.reduce((s, x) => s + x.impact, 0)).toBe(result.score);
  });
});

describe("CreateApplicationRequestSchema", () => {
  it("requires postingId or posting, and defaults status", () => {
    expect(CreateApplicationRequestSchema.safeParse({}).success).toBe(false);
    const parsed = CreateApplicationRequestSchema.parse({ postingId: "p_1" });
    expect(parsed.status).toBe("saved");
  });
});

describe("follow-ups", () => {
  it("is due only for awaiting statuses after followUpAt", () => {
    const now = new Date("2026-10-14T00:00:00Z");
    const followUpAt = defaultFollowUpAt(new Date("2026-10-01T00:00:00Z")).toISOString();
    expect(followUpAt).toBe("2026-10-08T00:00:00.000Z");
    expect(isFollowUpDue({ status: "applied", followUpAt }, now)).toBe(true);
    expect(isFollowUpDue({ status: "rejected", followUpAt }, now)).toBe(false);
    expect(isFollowUpDue({ status: "applied", followUpAt: null }, now)).toBe(false);
  });
});

describe("routes and test ids", () => {
  it("builds stable values", () => {
    expect(API_ROUTES.application("a/b")).toBe("/api/applications/a%2Fb");
    expect(signalRowTestId("posting_age")).toBe("rr-signal-row-posting_age");
  });
});
