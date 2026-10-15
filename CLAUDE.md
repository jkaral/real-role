# Real Role — guide for coding agents

This file is read by both agents: Claude Code reads `CLAUDE.md`, OpenAI Codex reads `AGENTS.md`. The two files are identical (CI enforces it with `pnpm check:agents`). Only Claude Code edits them: change `CLAUDE.md`, then copy it to `AGENTS.md` in the same PR.

The full shared brief (Part A) is reproduced verbatim at the end of this file and in `docs/PROJECT_BRIEF.md`. If anything below conflicts with Part A, Part A wins.

## Commands

Requires Node 22+ and pnpm 10 (`corepack enable` or `npm i -g pnpm`).

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm check` | Everything CI runs: format check, agent-docs check, lint, typecheck, test |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | One task across all packages (Turborepo) |
| `pnpm --filter @real-role/<pkg> test` | One package, e.g. `@real-role/ats` |
| `pnpm format` | Prettier write |
| `pnpm demo:video` | Build the demo video (owner: Codex) |
| `pnpm --filter @real-role/web dev` | Run the web app locally (needs `apps/web/.env.local`, see `.env.example`) |
| `pnpm --filter @real-role/web db:migrate` | Apply Drizzle migrations to `DATABASE_URL` |
| `ALLOW_DEMO_SEED=1 pnpm --filter @real-role/web db:seed-demo demo/output/seed.json` | Seed the demo manifest into a non-production database |
| `pnpm --filter @real-role/extension build` | Production extension build → `apps/extension/.output/chrome-mv3` (API: real-role.vercel.app) |
| `pnpm --filter @real-role/extension build:demo` | Demo/e2e build: API `http://localhost:3100`, also runs on `http://127.0.0.1/*` fixtures |
| `pnpm --filter @real-role/extension e2e` | End-to-end test: local web on PGlite + demo fixtures + real extension in Chromium |
| `pnpm --filter @real-role/extension zip` | Chrome Web Store zip → `apps/extension/.output/real-role-extension-<version>-chrome.zip` |

## Repo layout and package names

| Path | Package | Owner |
|---|---|---|
| `packages/shared` | `@real-role/shared` (the contract) | Claude Code, via contract process |
| `packages/scoring` | `@real-role/scoring` | Claude Code (`test/edge/**`: Codex) |
| `packages/ats` | `@real-role/ats` | Codex |
| `packages/parsers` | `@real-role/parsers` | Codex |
| `demo/` | `@real-role/demo` | Codex |
| `apps/web` | `@real-role/web` | Claude Code |
| `apps/extension` | `@real-role/extension` | Claude Code |

Internal packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`); there is no build step for them. Next.js (`transpilePackages`) and WXT/Vite compile them.

## The contract (`@real-role/shared`, tag `v0.1-contract`)

Import everything from `@real-role/shared`. Key exports:

- **Posting:** `ParsedPosting` / `ParsedPostingSchema`, `JobSource`, `PASTED_TEXT_URL`. Dates cross the wire as ISO-8601 strings.
- **Fingerprints:** `fingerprint(posting)` (title + company + description, digits ignored) and `roleKey(posting)` (title + company + location). Pure and synchronous; use them, don't re-implement.
- **Score:** `Signal`, `SignalId` (`posting_age`, `repost_history`, `careers_page_match`, `description_specificity`, `company_hiring_activity`), `ScoreResult`, `ScoringWeights`. Invariant: the `impact`s of all signals sum to `score`.
- **ATS:** `AtsAdapter`, `AtsBoard`, `AtsRole`, `MatchResult`, `AtsContext` (inject `fetch` + `AbortSignal`).
- **Parsers:** `PostingParser`, `ParseGeneric`, `ParsePosting`.
- **Applications:** `TrackedApplication`, `ApplicationStatus`, `isFollowUpDue`, `defaultFollowUpAt`.
- **API:** `API_ROUTES`, request/response zod schemas for `/api/score`, `/api/observe`, `/api/applications` (+ `PATCH`/`DELETE /api/applications/:id`), `ApiError`, `RATE_LIMIT_HEADERS`, `CONTRACT_VERSION`.
- **Test ids:** `TEST_IDS`, `signalRowTestId(id)`, `dashboardRowTestId(id)`, `byTestId(id)` in `packages/shared/src/testids.ts` (also importable as `@real-role/shared/testids`).

### Exports Codex's packages must keep

- `@real-role/ats`: `greenhouse`, `lever`, `ashby` (each an `AtsAdapter`), `adapters` (ordered list), `detectBoard(companyDomainOrUrl, ctx?, candidates?)`.
- `@real-role/parsers`: `parsers` (ordered `PostingParser[]`), `parseGeneric`, `parsePosting(document, url?)`.
- `@real-role/demo`: a `demo:video` script producing `demo/output/real-role-demo.mp4`.

The Phase 1 stubs already have these shapes. Replace the bodies; keep the names and signatures.

## Conventions

- TypeScript strict everywhere, plus `noUncheckedIndexedAccess`. No `any` in `shared`, `scoring`, `parsers`, `ats` (lint error). Use `unknown` + zod at boundaries.
- Validate all external data (HTTP responses, DOM-extracted JSON-LD, request bodies) with zod.
- Tests: Vitest, files in `<package>/test/**/*.test.ts`. Mock HTTP with msw; never hit real job boards or ATS APIs in tests. Parser tests use saved fixture HTML of **fictional** companies under jsdom.
- Fictional names only in fixtures, tests and demo (e.g. "Bramblecrest Analytics", "Northwind Lumen"); use `.example` domains.
- User-facing wording is neutral and factual. Never "fake", "scam", "ghost job" about a specific posting or employer.
- Line endings are LF (`.gitattributes`); Prettier formats everything except the verbatim brief files.
- Keep comments brief; explain why, not what.

## Branches, PRs and logs

- Branches: `claude/<topic>` or `codex/<topic>`. No direct pushes to `main`; PRs need green CI.
- Rebase on `main` before opening a PR. Conflict in a path you don't own: stop and log it in `docs/HANDOFF.md`.
- Fill in the PR template: what changed, owned paths touched, contract assumptions, how to test.
- Contract changes: PR labeled `contract-change`, explains why and who is affected, merges only after the owner confirms the other agent acknowledged it. Prefer additive, optional fields.
- `docs/WORKSTREAMS.md`: update your own rows in each PR. `docs/HANDOFF.md` and `docs/decisions.md`: append-only, dated, signed `[Claude Code]` or `[Codex]`.

---

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
