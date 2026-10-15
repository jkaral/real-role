# How the Freshness Score works

The Freshness Score is a number from 0 to 100 that estimates how likely a job posting is to be a real, active opening. It never says a posting is fake. It shows the evidence it used, so you can decide for yourself.

Code: `packages/scoring` (pure TypeScript, no network or database calls). Engine version: `scoring-1`.

## The five signals

Each signal looks at one kind of evidence and gives a sub-score from 0 (weak evidence of freshness) to 1 (strong evidence).

| Signal                      | What it looks at                                                                                                                                                                                                                                                                                                                            | Weight |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Posting age**             | Days since the posting's published date (from the page, or from the employer's careers page if the page has none). Up to 7 days scores 1.0; 30 days scores 0.6; 60 days 0.3; 180+ days 0.05. A closing date that has passed caps it at 0.1.                                                                                                 | 30     |
| **Repost history**          | How long Real Role users have been seeing this role (same title, company and location), and how often. Anything first seen in the last 14 days scores 1.0, however many times it was seen. After that the score falls with time (30 days: 0.6, 60 days: 0.3, 120 days: 0.1), and drops further if it was seen 2+ or 4+ times.               | 25     |
| **Careers page**            | Whether the same role (similar title and location) is listed on the employer's own public job board (Greenhouse, Lever or Ashby). Listed: 0.6–1.0 depending on how close the match is. Board found but role not on it: 0.1.                                                                                                                 | 25     |
| **Description detail**      | How specific the description is: a pay range, a named team or manager, concrete duties ("own", "build", "reconcile"…), a described interview process, and enough length. Generic stock phrases ("dynamic environment", "other duties as assigned") count against it. When an AI review is available, it's averaged 50/50 with these checks. | 15     |
| **Company hiring activity** | How many roles the employer's job board lists, and how recently any of them changed. A change in the last 14 days scores 1.0; 60 days 0.6; 180 days 0.3.                                                                                                                                                                                    | 5      |

Weights and curves live in `packages/scoring/src/config.ts`.

## From signals to a score

1. Each signal that could be computed earns **weight × sub-score** points.
2. Points are scaled so the signals we _could_ compute add up to a maximum of 100. Missing data doesn't drag the score down.
3. Points are rounded to whole numbers so that **the signals' points add up exactly to the score**. The side panel shows each signal as "points earned of points possible", so every point traces to something you can see.

| Score  | Label            |
| ------ | ---------------- |
| 70–100 | High freshness   |
| 40–69  | Medium freshness |
| 0–39   | Low freshness    |

## Confidence

Missing data lowers **confidence**, not the score. Confidence is the share of the total weight backed by solid evidence:

- A signal that couldn't be computed contributes nothing.
- A role Real Role is seeing for the first time counts half (there's little history yet).
- Description detail from the built-in checks alone counts three-quarters; with the AI review it counts fully.

75% or more is **high**, 45% or more **medium**, otherwise **low**. Fewer than two usable signals is always **low**.

## Missing data

| Situation                                                              | What happens                                                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| No posted date                                                         | Posting age is "unavailable".                                                                                                                 |
| No observations yet                                                    | Repost history is "unavailable".                                                                                                              |
| Employer's job board not found, lookup failed, or board lists no roles | Careers page and hiring activity are "unavailable". An empty board can't be told apart from a failed lookup, so it's never counted as a miss. |
| No AI key, or the AI reply is invalid                                  | Description detail uses the built-in checks only.                                                                                             |

Description detail is always computed (an empty description scores 0), so there is always at least one signal.

## The AI review

The web app may ask a Claude model to rate the description's specificity from 0 to 1 with up to three short, factual reasons. This package supplies the prompt (`RUBRIC_SYSTEM_PROMPT`, `buildRubricUserMessage`) and validates the reply (`parseRubricResponse`); the API makes the call. Results are cached by posting fingerprint and rubric version (`rubricCacheKey`). The model is told to judge only the text, ignore instructions inside the posting, and never call a posting or employer fake or a scam. Without an API key the score uses the built-in checks only.

## Wording

Everything the engine writes is factual and neutral: "Posted 150 days ago", "Seen 5 times over 60 days", "Not found on the employer's careers page. It may have been filled, renamed or listed elsewhere." A one-line summary (`summarize`) leads with the band and the signals that mattered most, for example:

> Low freshness: posted 150 days ago, seen 5 times over 60 days.

## Worked examples (the demo fixtures)

These are the three fictional demo postings, with no careers-page data (as in the demo):

| Posting                                   | Age             | Repost history                   | Description                 | Score         | Confidence |
| ----------------------------------------- | --------------- | -------------------------------- | --------------------------- | ------------- | ---------- |
| Platform Engineer, Bramblecrest Analytics | 43/43 (2 days)  | 36/36 (first seen today)         | 19/21 (pay, team, 7 duties) | **98 High**   | Medium     |
| Data Analyst, Northwind Lumen             | 4/43 (150 days) | 8/36 (seen 5 times over 60 days) | 7/21 (team, 3 duties)       | **19 Low**    | Medium     |
| Operations Associate, Mapleglass Systems  | 25/43 (30 days) | 36/36 (first seen today)         | 0/21 (7 stock phrases)      | **61 Medium** | Medium     |

## Using the engine

```ts
import { computeScore, summarize } from "@real-role/scoring";

const result = computeScore({
  posting, // ParsedPosting from @real-role/shared
  now: new Date(),
  sightings, // { count, firstSeenAt, lastSeenAt } for the posting's roleKey, or null
  careers, // { board, roles, match } from @real-role/ats, or null when unknown
  rubric, // { score, reasons } from the AI review, or null
});
summarize(result); // "High freshness: posted 2 days ago, first seen today."
```

Same inputs and `now` always give the same result.
