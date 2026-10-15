import type { AtsRole, ParsedPosting } from "@real-role/shared";
import type { CareersEvidence, ScoringInput } from "../src";

// Fictional employers only (A2).
export const NOW = new Date("2026-10-15T12:00:00.000Z");
export const DAY = 86_400_000;
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

export const SPECIFIC_DESCRIPTION =
  "Join the Platform team reporting to Engineering Manager Rowan Vale. Own TypeScript deployment pipelines, review service reliability metrics weekly, and ship accessible monitoring dashboards. Collaborate with four engineers to reduce build times. Salary CAD 110,000–140,000 per year. The interview process includes a technical conversation and a paid work sample.";

export const VAGUE_DESCRIPTION =
  "We seek a motivated individual to join a dynamic environment. The successful candidate will perform various duties and other tasks as assigned. Strong communication skills and a positive attitude are desirable. Further details will be shared during the interview.";

export const MODERATE_DESCRIPTION =
  "Join the Finance Analytics team. Maintain monthly revenue dashboards, validate SQL models, and report to the analytics manager. Coordinate metric definitions with finance stakeholders.";

export function posting(overrides: Partial<ParsedPosting> = {}): ParsedPosting {
  return {
    title: "Platform Engineer",
    company: "Bramblecrest Analytics",
    location: "Toronto, ON",
    postedAt: daysAgo(2),
    descriptionText: SPECIFIC_DESCRIPTION,
    sourceUrl: "http://127.0.0.1:4173/jobs/fresh",
    source: "generic",
    parsedBy: "generic-jsonld",
    ...overrides,
  };
}

export function role(overrides: Partial<AtsRole> = {}): AtsRole {
  return {
    provider: "greenhouse",
    id: "101",
    title: "Platform Engineer",
    location: "Toronto, ON",
    url: "https://boards.greenhouse.io/bramblecrest/jobs/101",
    updatedAt: daysAgo(3),
    ...overrides,
  };
}

export function careers(matched: boolean, roles: AtsRole[] = [role()]): CareersEvidence {
  return {
    board: {
      provider: "greenhouse",
      boardToken: "bramblecrest",
      boardUrl: "https://boards.greenhouse.io/bramblecrest",
      companyName: "Bramblecrest Analytics",
    },
    roles,
    match: matched
      ? {
          matched: true,
          role: roles[0],
          confidence: 0.9,
          method: "fuzzy_title",
          reason: "Same title and location.",
        }
      : { matched: false, confidence: 0, method: "none", reason: "No similar title." },
  };
}

export function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    posting: posting(),
    now: NOW,
    sightings: { count: 1, firstSeenAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() },
    ...overrides,
  };
}
