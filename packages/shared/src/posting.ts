import { z } from "zod";

/** Where a posting was read from. `generic` means the JSON-LD / heuristic fallback parser. */
export const JOB_SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "linkedin",
  "indeed",
  "wellfound",
  "generic",
  "pasted_text",
] as const;
export const JobSourceSchema = z.enum(JOB_SOURCES);
export type JobSource = z.infer<typeof JobSourceSchema>;

export const SALARY_PERIODS = ["hour", "day", "week", "month", "year"] as const;

export const SalarySchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  /** ISO 4217 code, e.g. "USD". */
  currency: z.string().length(3).optional(),
  period: z.enum(SALARY_PERIODS).optional(),
});
export type Salary = z.infer<typeof SalarySchema>;

/** `sourceUrl` for postings pasted as text on the check page. */
export const PASTED_TEXT_URL = "about:pasted-text";

/** ISO-8601 timestamp string (with offset or Z). Dates cross the wire as strings. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * The fields extracted from one job posting. Produced by `PostingParser`s (extension and
 * /check page) and by the API for pasted text. Only these fields are ever stored (A2: minimal data).
 */
export const ParsedPostingSchema = z.object({
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(200),
  /** Employer's own domain if known, e.g. "acme-robotics.example". Used for ATS detection. */
  companyDomain: z.string().max(253).optional(),
  /** Employer careers page URL if the posting links to it. */
  companyCareersUrl: z.string().url().optional(),
  location: z.string().max(200).optional(),
  remote: z.boolean().optional(),
  employmentType: z.string().max(60).optional(),
  /** When the posting says it was published (from page or JSON-LD `datePosted`). */
  postedAt: IsoDateTimeSchema.optional(),
  /** JSON-LD `validThrough`, if present. */
  validThrough: IsoDateTimeSchema.optional(),
  /** Plain-text description (HTML stripped). */
  descriptionText: z.string().max(50_000),
  salary: SalarySchema.optional(),
  /** The page the user was viewing. Pasted text uses `PASTED_TEXT_URL`. */
  sourceUrl: z.string().min(1).max(2048),
  source: JobSourceSchema,
  /** The board's own id for this job, when visible on the page. */
  externalId: z.string().max(200).optional(),
  /** `PostingParser.id` that produced this object (e.g. "greenhouse", "generic-jsonld"). */
  parsedBy: z.string().min(1).max(60),
});
export type ParsedPosting = z.infer<typeof ParsedPostingSchema>;
