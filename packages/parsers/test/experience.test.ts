import { describe, expect, it } from "vitest";
import { extractExperienceMinimum } from "../src";
describe("explicit experience requirements", () => {
  it.each([
    "At least 3 years of experience",
    "Minimum of 3 years relevant experience",
    "Requires 3 years of professional experience",
    "3+ years of experience",
  ])("extracts %s", (text) => expect(extractExperienceMinimum(text)).toBe(3));
  it.each([
    "Senior Engineer",
    "Founded 3 years ago",
    "3–5 years of experience",
    "At least 3 years of experience and at least 2 years of experience with SQL",
    "Minimum 99 years of experience",
  ])("leaves ambiguous or absent details unknown: %s", (text) =>
    expect(extractExperienceMinimum(text)).toBeUndefined(),
  );
});
