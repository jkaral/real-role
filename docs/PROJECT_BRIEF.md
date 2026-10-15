# Real Role — Project brief

> Part A of the owner's brief, verbatim. Shared by Claude Code and Codex. Do not edit; changes to scope go through the owner and `docs/decisions.md`.

# PART A — Shared project brief (Codex receives the identical text)

## A1. The product

**The problem.** Job seekers waste hours applying to postings that are stale, reposted indefinitely, or never meant to be filled ("ghost jobs"). 69% of job seekers report running into fake postings, and almost half are applying to more jobs than a year ago.

**What Real Role does.** It gives any job posting a **Freshness Score** from 0 to 100: how likely the posting is to be a real, active opening. Every score shows the specific signals behind it, so the user decides for themselves. It also tracks the user's applications and nudges them to follow up at the right time.

**Who it's for.** Active job seekers, starting with tech and office roles in North America.

**Surfaces:**
1. **Chrome extension (Manifest V3).** On a job posting page the user is already viewing, a small badge shows the score. Clicking it opens a side panel with the signal breakdown and a "Save & track" button.
2. **Web app.** A landing page, a "check a posting" page (paste a URL or the posting text), and a signed-in dashboard listing tracked applications with follow-up reminders.
3. **API.** Shared by both surfaces.

**Final deliverables:** a public GitHub repo with green CI; the web app live on Vercel; a Chrome Web Store–ready extension zip plus listing docs; and an AI-narrated demo video recorded from an automated test run of the real product.

## A2. Non-negotiable design rules

- **Read only what the user is viewing.** The extension reads the DOM of the page the user has open in their own browser. Never bulk-crawl or scrape job boards from the server, and never automate logged-in sessions.
- **Use only public, official data sources for cross-checks.** Check employers' own careers pages through the public job-board APIs of applicant-tracking systems (Greenhouse, Lever and Ashby to start; check each one's current docs before coding against it). Treat Workday and others as a later, pluggable adapter.
- **Phrase results neutrally and factually.** Say "Low freshness: reposted 4 times in 60 days, not listed on the company careers page." Never say "fake" or "scam," and never accuse an employer. Show signals and confidence, not verdicts.
- **Minimal data.** Store only a posting fingerprint, extracted fields and observation timestamps, plus the user's own tracked items. No résumés, no browsing history.
- **Explainable over clever.** Every point in the score must trace to a signal shown in the UI.
- **Demo content is fictional.** Never use real companies' names or real postings in fixtures, tests or the demo video.

## A3. The scoring engine

`packages/scoring` is a pure TypeScript package with no I/O, fully unit-tested. Signals:

| Signal | How it's computed | Weight to start with |
|---|---|---|
| Posting age | Posted date from the page or the ATS API | High |
| Repost history | Fingerprint of the normalized title, company and description; count of sightings across Real Role users, and over what span | High |
| Careers-page match | Is the same role (fuzzy title and location match) live on the employer's own ATS board? | High |
| Description specificity | Heuristics (salary range present, concrete responsibilities, team or manager mentioned, boilerplate ratio) plus an LLM rubric call through the Claude API returning structured JSON with a 0–1 score and reasons | Medium |
| Company hiring activity | Count of open roles on the employer's ATS board, and how recently they changed | Low–medium |
| Missing data | When a signal can't be computed, lower the confidence instead of the score | n/a |

Output: `{ score: number, confidence: "low"|"medium"|"high", signals: Signal[], computedAt }`, where each `Signal` has `{ id, label, value, impact, explanation }`. Weights live in config. Write `docs/scoring.md` explaining the model in plain language. Use the cheapest Claude model that does the rubric well, cache results by fingerprint, and fall back to heuristics alone when no API key is set.

## A4. Architecture and stack

A monorepo using pnpm workspaces and Turborepo, TypeScript strict mode throughout:

```
apps/web         Next.js (App Router) + Tailwind: landing, check page, dashboard, API routes
apps/extension   Chrome MV3 extension (WXT, or Vite + CRXJS); side panel UI
packages/shared  Shared types + zod schemas + API contract  ← THE CONTRACT
packages/scoring Pure scoring engine
packages/parsers DOM parsers per job board + generic JSON-LD fallback
packages/ats     ATS adapters (greenhouse, lever, ashby) behind one interface
demo/            Fixture job pages + demo-video pipeline
docs/            Brief, workstreams, handoff log, decisions, scoring, store listing
```

- **DB:** Postgres (Neon or Supabase) with Drizzle ORM. Tables: `postings`, `observations`, `tracked_applications`, `users`.
- **Auth:** Auth.js (email magic link or GitHub sign-in). The extension works without an account; tracking requires sign-in.
- **API:** Next.js route handlers (`POST /api/score`, `POST /api/observe`, `GET/POST /api/applications`), validated with zod and rate-limited.
- **Secrets:** list them in `.env.example`; never commit real values.

## A5. The demo video

The output is `demo/output/real-role-demo.mp4`, 60–90 seconds long, regenerated with one command: `pnpm demo:video`.
1. **Fixtures.** Three locally served pages with JSON-LD for fictional companies: one fresh and specific (high score), one stale and reposted (low), and one vague (medium). Seed DB observations so the repost history is real.
2. **Recorded run.** Playwright launches Chromium with the built extension loaded, visits each fixture, opens the side panel, saves a posting, then shows it in the web dashboard. Record at 1920×1080 with readable pauses and a visible click highlight.
3. **The run is also a test.** It asserts on scores and UI states, and fails the build if they're wrong. Add it to CI as an optional job.
4. **Narration.** A script in `demo/script.md`, voiced with ElevenLabs or OpenAI TTS if a key is set, otherwise free local TTS (`edge-tts` or Piper).
5. **Assembly.** ffmpeg merges video and audio, burns in SRT captions, and adds a title card and an end card with the live URL.

## A6. Quality bar

- TypeScript strict mode; no `any` in `scoring`, `parsers`, `ats` or `shared`.
- Unit tests for scoring, parsers and adapters (mock HTTP with msw or nock). One end-to-end Playwright test for the main flow, separate from the demo.
- Accessible, credible UI that looks like a real startup's product.
- When unsure about an external API, check its current docs instead of guessing.

## A7. How the two agents collaborate

**Ownership.** Each agent edits **only** the paths it owns. To change something the other agent owns, open an issue or describe it in `docs/HANDOFF.md`; don't edit it yourself.

| Area | Owner |
|---|---|
| Phase 1 scaffold, root config, CI, `CLAUDE.md`, `AGENTS.md` | Claude Code |
| `packages/shared` (the contract) | Claude Code; changes go through the contract process below |
| `packages/scoring` source | Claude Code |
| `packages/scoring/test/edge/**` (extra edge-case tests) | Codex |
| `apps/web`, the database and migrations, Vercel deployment | Claude Code |
| `apps/extension` | Claude Code |
| `packages/ats` | Codex |
| `packages/parsers` | Codex |
| `demo/**` (fixtures, recording, narration, assembly) | Codex |
| `docs/chrome-web-store.md`, final README | Claude Code |
| `docs/WORKSTREAMS.md`, `docs/HANDOFF.md` | Both, adding entries only and never rewriting the other's |

**Branches and pull requests:**
- Claude Code uses `claude/<topic>` branches and Codex uses `codex/<topic>`.
- Nobody pushes directly to `main` after Phase 1. Everything goes through a pull request with green CI.
- Every pull request description states: what changed, which owned paths it touched, any contract assumptions, and how to test it.
- Each agent reviews the other's pull requests when the owner asks: Claude Code reviews `codex/*` and Codex reviews `claude/*`. Reviews check correctness, the design rules in A2, and the contract.
- Rebase on `main` before opening a pull request. If you hit a conflict in a path you don't own, stop and log it in `HANDOFF.md`; don't resolve it yourself.

**The contract (`packages/shared`):**
- It is frozen once tagged `v0.1-contract`. Both agents build against it.
- To change it, open a pull request labeled `contract-change` that explains why and lists who's affected. It merges only after the owner says the other agent has acknowledged it.
- Additive changes (new optional fields) are preferred over breaking changes.

**Interfaces Codex's packages must satisfy (defined by Claude Code in Phase 1):**
- `AtsAdapter`: `detect(companyDomainOrUrl) → board | null`, `listOpenRoles(board) → AtsRole[]`, `findMatch(posting, roles) → MatchResult`.
- `PostingParser`: `canParse(url, document) → boolean`, `parse(document) → ParsedPosting | null`, plus a `parseGeneric` JSON-LD fallback.
- Demo hooks: stable `data-testid` attributes on the extension badge, side panel, score, signal rows, save button and dashboard rows, listed in `packages/shared/testids.ts`.

**Communication:**
- `docs/WORKSTREAMS.md` is a checkbox board of every task with its owner and status. Update your own rows in each pull request.
- `docs/HANDOFF.md` is an append-only log, with entries dated and signed `[Claude Code]` or `[Codex]`: blockers, questions for the other agent, and "X is ready for you" notices.
- `docs/decisions.md` is an append-only log of notable choices and why.
- When you need something from the other agent, write it in `HANDOFF.md` **and** tell the owner in your summary so they can relay it.

**Order of work:**
1. Claude Code does Phase 1 alone. When it's merged, tag it `v0.1-contract`. The owner then starts Codex.
2. Parallel work:
   - Claude Code: scoring engine, then web app, API and deployment, then the extension.
   - Codex: ATS adapters, parsers, scoring edge tests, and the demo pipeline built against fixtures.
3. Integration: Claude Code wires `ats` and `parsers` into the API and extension once Codex's pull requests are merged.
4. Codex records the final demo video once the extension and the deployed web app are ready (`HANDOFF.md` will say so).
5. Claude Code does the final polish, README and launch check.

**Both agents:** ask the owner only for things you can't do yourself: account logins, API keys, the Chrome Web Store submission, and decisions that are genuinely the owner's. If something in this brief is infeasible, say so and propose the closest alternative instead of silently changing scope.
