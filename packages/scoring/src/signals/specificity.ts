import type { ParsedPosting } from "@real-role/shared";
import { LLM_BLEND, RELIABILITY } from "../config";
import type { ScoringInput, SignalDraft } from "../types";
import { clamp, joinAnd, plural } from "../util";
import { LABELS } from "./common";

const ACTION_VERBS = [
  "own",
  "build",
  "ship",
  "design",
  "develop",
  "implement",
  "maintain",
  "migrate",
  "deploy",
  "test",
  "review",
  "analyze",
  "analyse",
  "validate",
  "coordinate",
  "collaborate",
  "reduce",
  "improve",
  "deliver",
  "lead",
  "mentor",
  "write",
  "automate",
  "monitor",
  "optimize",
  "negotiate",
  "prepare",
  "present",
  "reconcile",
  "audit",
  "forecast",
  "support",
  "train",
];
const VERB_RE = new RegExp(`\\b(${ACTION_VERBS.join("|")})(s|es|ed|d|ing)?\\b`, "gi");

const BOILERPLATE = [
  /motivated individual/i,
  /dynamic (environment|team|company)/i,
  /fast[- ]paced/i,
  /other (duties|tasks)( as assigned)?/i,
  /various duties/i,
  /team player/i,
  /self[- ]starter/i,
  /positive attitude/i,
  /(strong|excellent) communication skills/i,
  /competitive (salary|pay|compensation)/i,
  /\b(rock ?star|ninja|guru)\b/i,
  /(details|more information) will be (shared|provided)/i,
  /wear many hats/i,
  /hit the ground running/i,
];

const SALARY_RE =
  /(\$|usd|cad|eur|gbp|€|£)\s?\d[\d,.]*\s?k?\s*(-|–|—|to)\s*(\$|usd|cad|eur|gbp|€|£)?\s?\d|\bsalary\b[^.]{0,40}\d{2}/i;
const TEAM_RE =
  /\breport(s|ing)? (directly )?to\b|\b(hiring|engineering|product|team|analytics|finance|sales|design) (manager|lead)\b|\bthe [\w-]+( [\w-]+)? team\b|\bteam of \w+/i;
const PROCESS_RE = /\binterview(s|ing)?\b|\bhiring process\b/i;

export interface DescriptionFeatures {
  words: number;
  salary: boolean;
  duties: number;
  team: boolean;
  process: boolean;
  boilerplate: number;
  /** 0–1 heuristic sub-score. */
  score: number;
}

/** Explainable heuristics. Each feature appears in the signal's detail text. */
export function analyzeDescription(
  posting: Pick<ParsedPosting, "descriptionText" | "salary">,
): DescriptionFeatures {
  const text = posting.descriptionText;
  const words = text.split(/\s+/).filter(Boolean).length;
  const salary =
    posting.salary?.min !== undefined || posting.salary?.max !== undefined || SALARY_RE.test(text);
  const duties = new Set(Array.from(text.matchAll(VERB_RE), (m) => (m[1] ?? "").toLowerCase()))
    .size;
  const team = TEAM_RE.test(text);
  const process = PROCESS_RE.test(text);
  const boilerplate = BOILERPLATE.filter((re) => re.test(text)).length;

  if (words === 0) {
    return { words, salary, duties, team, process, boilerplate, score: salary ? 0.25 : 0 };
  }

  const score = clamp(
    0.1 +
      (salary ? 0.25 : 0) +
      (Math.min(duties, 5) / 5) * 0.25 +
      (team ? 0.2 : 0) +
      (process ? 0.1 : 0) +
      (words >= 120 ? 0.1 : 0) -
      Math.min(0.3, boilerplate * 0.1) -
      (words < 40 ? 0.1 : 0),
  );
  return { words, salary, duties, team, process, boilerplate, score };
}

function describe(f: DescriptionFeatures): string {
  if (f.words === 0) return "No description text";
  const found = [
    f.salary ? "pay range" : null,
    f.team ? "team or manager" : null,
    f.duties > 0 ? `${f.duties} concrete ${f.duties === 1 ? "duty" : "duties"}` : null,
  ].filter((x): x is string => x !== null);
  if (f.score < 0.4 && f.boilerplate > 0) {
    return `Mostly generic wording (${plural(f.boilerplate, "stock phrase")})`;
  }
  return found.length > 0 ? `Lists ${joinAnd(found)}` : "Few concrete details";
}

export function specificitySignal({ posting, rubric }: ScoringInput): SignalDraft {
  const f = analyzeDescription(posting);
  const value = rubric ? (1 - LLM_BLEND) * f.score + LLM_BLEND * clamp(rubric.score) : f.score;

  let explanation =
    "Specific postings (pay, concrete duties, a named team or manager) are more likely to be active openings.";
  if (f.boilerplate > 0) {
    explanation += ` This one uses ${plural(f.boilerplate, "generic stock phrase")}.`;
  }
  if (rubric && rubric.reasons.length > 0) {
    explanation += ` AI review: ${rubric.reasons.slice(0, 2).join(" ")}`;
  }

  return {
    id: "description_specificity",
    label: LABELS.description_specificity,
    value,
    detail: describe(f),
    explanation,
    reliability: rubric ? 1 : RELIABILITY.heuristicsOnly,
  };
}
