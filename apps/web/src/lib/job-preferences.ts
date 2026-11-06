import { z } from "zod";
import { SalarySchema, type ParsedPosting } from "@real-role/shared";
import { extractExperienceMinimum } from "@real-role/parsers";

export const JobPreferencesSchema = z.object({
  titles: z.string().trim().max(300).default(""),
  location: z.string().trim().max(200).default(""),
  remote: z.enum(["any", "remote", "onsite"]).default("any"),
  employmentType: z.string().trim().max(60).default(""),
  salaryMin: z.number().nonnegative().max(100000000).nullable().default(null),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),
  period: z.enum(["hour", "day", "week", "month", "year"]).default("year"),
  experienceYears: z.number().int().min(0).max(60).nullable().default(null),
});
export type JobPreferences = z.infer<typeof JobPreferencesSchema>;
export const JobFactsSchema = z.object({
  location: z.string().max(200).optional(),
  remote: z.boolean().optional(),
  employmentType: z.string().max(60).optional(),
  salary: SalarySchema.refine(
    (s) => s.min === undefined || s.max === undefined || s.min <= s.max,
  ).optional(),
  experienceMinYears: z.number().int().min(0).max(60).optional(),
});
export type JobFacts = z.infer<typeof JobFactsSchema>;
export const DEFAULT_PREFERENCES = JobPreferencesSchema.parse({});

export function factsFromPosting(posting: ParsedPosting): JobFacts {
  const salary = JobFactsSchema.shape.salary.safeParse(posting.salary);
  return JobFactsSchema.parse({
    location: posting.location,
    remote: posting.remote,
    employmentType: posting.employmentType,
    salary: salary.success ? salary.data : undefined,
    experienceMinYears: extractExperienceMinimum(posting.descriptionText),
  });
}

export function assessFit(title: string, facts: JobFacts, preferences: JobPreferences) {
  const matched: string[] = [],
    mismatched: string[] = [],
    unknown: string[] = [];
  const check = (name: string, value: boolean | undefined) =>
    (value === undefined ? unknown : value ? matched : mismatched).push(name);
  const words = preferences.titles
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (words.length)
    check(
      "Job title",
      words.some((word) => title.toLowerCase().includes(word)),
    );
  if (preferences.location)
    check(
      "Location",
      facts.location
        ? facts.location.toLowerCase().includes(preferences.location.toLowerCase())
        : undefined,
    );
  if (preferences.remote !== "any")
    check(
      "Workplace",
      facts.remote === undefined ? undefined : facts.remote === (preferences.remote === "remote"),
    );
  if (preferences.employmentType)
    check(
      "Employment type",
      facts.employmentType
        ? facts.employmentType.toLowerCase().replace(/[\s_-]/g, "") ===
            preferences.employmentType.toLowerCase().replace(/[\s_-]/g, "")
        : undefined,
    );
  if (preferences.salaryMin !== null) {
    const pay = facts.salary;
    check(
      "Salary",
      !pay ||
        pay.currency !== preferences.currency ||
        pay.period !== preferences.period ||
        pay.max === undefined
        ? undefined
        : pay.max >= preferences.salaryMin,
    );
  }
  if (preferences.experienceYears !== null)
    check(
      "Experience",
      facts.experienceMinYears === undefined
        ? undefined
        : facts.experienceMinYears <= preferences.experienceYears,
    );
  return { matched, mismatched, unknown };
}
