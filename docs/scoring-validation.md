# Scoring validation and calibration plan

How we'll check whether the Freshness Score means what we say it means, before anyone tunes weights or claims accuracy. Engine: `scoring-1` (`packages/scoring`, explained in [`scoring.md`](scoring.md)). Written 2026-10-16 by Claude Code. **No weights change as part of this plan.**

## 1. What the score is, and isn't

**It is** a 0–100 ranking of how much observable evidence suggests a posting is a current, active opening. It comes from five signals (posting age, repost history, careers-page listing, description detail, company hiring activity), with a separate confidence level for how much evidence was available.

**It is not:**

- **A probability.** "80" doesn't mean an 80% chance of anything. We must not describe it as one until section 6's calibration criteria are met.
- **A prediction of hiring outcomes.** It doesn't predict whether a user gets an interview or an offer, or whether a hire happens.
- **A judgement of intent.** It never says a posting is fake or that an employer is acting in bad faith (design rule A2).

Each signal measures something narrower than "real and active". The evaluation must keep these apart:

| Construct                         | What we can observe                                       | What it is _not_ evidence of                              |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **Listing presence**              | The role is on the employer's own ATS board right now     | That it's being actively filled; boards can lag too       |
| **Stale advertisement date**      | The posted date on the page or board is old               | That it's closed: evergreen and pipeline roles exist      |
| **Repeat observations**           | Real Role users saw the same role key over a span of days | Reposting by the employer; it may just be widely viewed   |
| **Description specificity**       | Pay, team, duties, process present in the text            | Legitimacy; specific text can still be stale              |
| **Hiring outcome** (not a signal) | Only from consented user reports (section 3)              | n/a; this is the hardest label and the one we never infer |

## 2. Questions the evaluation answers

1. **Ranking:** do postings that are later confirmed active score higher than postings later confirmed closed? (AUC, and precision at each band.)
2. **Signal accuracy:** for each signal, how often is its underlying claim right? (Section 4.)
3. **Coverage:** how often is each signal unavailable, by job board and region? (Unknown-evidence rate.)
4. **Confidence:** are high-confidence scores more accurate than low-confidence ones? If not, confidence is mislabelled.
5. **Calibration:** only if we ever want probability wording (section 6).

## 3. Evaluation corpus: permitted sources only

Design rules A2 apply in full: no bulk crawling of job boards, no logged-in automation, no real applicant histories, and fictional data in tests.

| Source                                                                                               | Labels it can provide                                                     | Status                                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Fictional fixtures** (`packages/scoring/test`, `demo/`)                                            | Engine behaviour and invariants                                           | **Exists**; see section 7                                                       |
| **Public ATS APIs, sampled** (Greenhouse, Lever, Ashby), with re-checks of the same boards over time | Listing presence and disappearance over time, and board-side `updated_at` | Planned. Bounded sample, official APIs only, respecting their rate limits       |
| **Anonymous sightings** already stored (role key, URL, day; no user link)                            | Repeat-observation spans                                                  | Exists in production; aggregate use only                                        |
| **Consented user outcome reports** (opt-in: "Did you hear back?", "Was the role filled?")            | Hiring-outcome and "still open" labels                                    | **Not built.** Needs owner approval, a privacy-page update and a retention rule |

Hard limits: no résumés or description text stored for evaluation; any outcome labels are opt-in, deletable, and kept separate from user identity in exported datasets; reports are aggregated with a minimum cell size of 20 before anything is published.

## 4. Label definitions

All labels are taken at a **reference time** T, the moment a posting was scored, and observed afterwards.

| Label              | Definition                                                                                                          | Source                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `listed@T`         | Exact listing ID present on the employer's ATS board at T                                                           | ATS API                 |
| `delisted@T+30`    | Listed at T, absent from **two** successful board reads ≥ 7 days apart within T+30. A failed read is never "absent" | ATS API re-checks       |
| `stale_date`       | Posted date more than 60 days before T                                                                              | Page or ATS             |
| `reposted`         | Same role key seen on ≥ 2 distinct days over a span of ≥ 30 days                                                    | Sightings               |
| `active` (outcome) | A consenting user reports a response or interview from this posting within 45 days                                  | User report (not built) |
| `unknown`          | Any label whose source couldn't be read. Kept as unknown; **never imputed** as negative                             | n/a                     |

## 5. Metrics and acceptance criteria

Reported per board (Greenhouse, Lever, Ashby, Workday, LinkedIn, Indeed, Wellfound, generic JSON-LD) and per region, never only pooled:

| Metric                    | Definition                                                                                                                 | Initial target, to be revisited with data |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Match precision**       | Of careers-page matches the engine reports, the share that a reviewer confirms are the same role                           | ≥ 0.95                                    |
| **False-absence rate**    | Of "not on the employer's board" results, the share where the role _was_ on the board (wrong board, title variant, region) | ≤ 0.05                                    |
| **Unknown-evidence rate** | Share of scored postings where each signal is unavailable                                                                  | Report only; drives coverage work         |
| **Ranking quality**       | AUC of score for `delisted@T+30` (negative) vs still `listed` (positive)                                                   | ≥ 0.70 before any accuracy claim          |
| **Band precision**        | Share of high-band postings still listed at T+30, and share of low-band postings delisted                                  | Report with 95% intervals                 |
| **Confidence separation** | Ranking quality computed within high- vs low-confidence groups                                                             | High must beat low                        |

**Sample size:** a proportion near 0.9 needs about 140 labelled items for a ±5% 95% interval, and about 385 for a proportion near 0.5. Don't report a per-board metric with fewer than 100 labelled items. Show "insufficient data" instead.

## 6. Calibration, only if probabilities are ever advertised

If the product ever says "likely to be active" in percentage terms:

- Fit an isotonic or logistic map from score to the `active` outcome label (section 4) on a held-out, time-split set (train on earlier months, evaluate on later ones).
- Report a reliability diagram and expected calibration error (ECE) with 10 bins; require ECE ≤ 0.05 and at least 1,000 outcome labels across boards.
- Re-check each quarter and after any engine version change. Until then, the UI keeps band and confidence wording only.

## 7. Repeatable protocol

1. **Freeze** the engine version (`ENGINE_VERSION`) and the dataset snapshot ID for the run.
2. **Run the invariant suite** with `pnpm --filter @real-role/scoring test`. `test/evaluation.test.ts` checks the properties this plan assumes:
   - an older posting never scores higher
   - a longer or more frequent repost history never scores higher
   - a careers-page listing never scores lower than an absence
   - missing evidence never raises confidence
   - the engine is deterministic

   A failure there invalidates the run.

3. **Score** the labelled snapshot offline with `computeScore` (pure; no network). Evidence comes from the snapshot, not live calls.
4. **Compute** section 5's metrics per board and region, with intervals.
5. **Review** a random 50 disagreements by hand: high-band postings that were delisted, and low-band postings that stayed listed. Classify each as signal error, label error or out-of-scope.
6. **Record** the results in a dated section of this file. Weight or curve changes are separate PRs that cite a run, bump `ENGINE_VERSION`, and update `scoring.md`. Codex reviews them through the normal process.

## 8. Limitations

- ATS presence is a proxy. Some employers keep filled roles listed, or fill roles that were never on an ATS board.
- Sightings reflect where Real Role users browse, not the job market. Early on, the sample is small and skewed.
- Workday, LinkedIn and Indeed have no careers-page cross-check today, so their careers-page signal is usually unavailable. Read pooled metrics with that in mind.
- Outcome labels from users are self-selected. Users who report back may differ from those who don't.
- Until there are enough labels, results are descriptive only and must not appear in marketing copy.
