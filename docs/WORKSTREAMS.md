# Workstreams

Checkbox board of every task. Each agent updates **only its own rows**, in the PR that changes them. Status: `todo`, `in progress`, `in review` (PR open), `done`, `blocked`.

## Phase 1 — Scaffold and contract (Claude Code, alone)

| Done | Task                                                                                   | Owner       | Status |
| ---- | -------------------------------------------------------------------------------------- | ----------- | ------ |
| [x]  | Monorepo: pnpm workspaces, Turborepo, TS strict, ESLint, Prettier, Vitest              | Claude Code | done   |
| [x]  | CI: lint, typecheck, test (+ optional demo job)                                        | Claude Code | done   |
| [x]  | `packages/shared` contract: types, zod schemas, API contract, interfaces, `testids.ts` | Claude Code | done   |
| [x]  | Stub packages: `ats`, `parsers`, `scoring`, `demo`, `apps/web`, `apps/extension`       | Claude Code | done   |
| [x]  | `CLAUDE.md` / `AGENTS.md`, `docs/PROJECT_BRIEF.md`, logs                               | Claude Code | done   |
| [x]  | GitHub repo, PR merged, tag `v0.1-contract`                                            | Claude Code | done   |

## Phase 2 — Parallel work

### Claude Code

| Done | Task                                                                            | Owner       | Status    |
| ---- | ------------------------------------------------------------------------------- | ----------- | --------- |
| [x]  | Scoring engine (`packages/scoring`) with unit tests                             | Claude Code | done      |
| [x]  | `docs/scoring.md` (plain-language model)                                        | Claude Code | done      |
| [x]  | LLM specificity rubric (Claude API, cached by fingerprint, heuristic fallback)  | Claude Code | done      |
| [x]  | DB schema + migrations (Drizzle, Neon)                                          | Claude Code | done      |
| [x]  | Auth.js with GitHub sign-in                                                     | Claude Code | done      |
| [x]  | API routes: `/api/score`, `/api/observe`, `/api/applications` (+ rate limiting) | Claude Code | done      |
| [x]  | Web: landing page                                                               | Claude Code | done      |
| [x]  | Web: check page (URL or text)                                                   | Claude Code | done      |
| [x]  | Web: dashboard with follow-up reminders                                         | Claude Code | done      |
| [x]  | Vercel production deploy; "web app live" in HANDOFF                             | Claude Code | done      |
| [ ]  | Extension: badge, side panel, save & track (WXT, MV3)                           | Claude Code | in review |
| [ ]  | Extension: unpacked build + Web Store zip; "extension build ready" in HANDOFF   | Claude Code | in review |
| [ ]  | `docs/chrome-web-store.md` (listing, privacy answers, screenshot list)          | Claude Code | in review |

### Codex

| Done | Task                                                                                | Owner | Status    |
| ---- | ----------------------------------------------------------------------------------- | ----- | --------- |
| [x]  | ATS adapter: Greenhouse (public Job Board API) + msw tests                          | Codex | done      |
| [x]  | ATS adapter: Lever (public Postings API) + msw tests                                | Codex | done      |
| [x]  | ATS adapter: Ashby (public Job Postings API) + msw tests                            | Codex | done      |
| [x]  | `detectBoard` + fuzzy `findMatch` (title + location)                                | Codex | done      |
| [x]  | Parser: generic JSON-LD `JobPosting` fallback (`parseGeneric`)                      | Codex | done      |
| [x]  | Parsers: board-specific (Greenhouse, Lever, Ashby hosted pages; others as feasible) | Codex | done      |
| [ ]  | Scoring edge-case tests in `packages/scoring/test/edge/**` (after scoring lands)    | Codex | in review |
| [x]  | Demo: three fictional fixture pages with JSON-LD (high / low / medium)              | Codex | done      |
| [x]  | Demo: seed observations for repost history                                          | Codex | done      |
| [ ]  | Demo: Playwright recorded run with extension, assertions, click highlight           | Codex | in review |
| [ ]  | Demo: narration script + TTS (ElevenLabs/OpenAI or edge-tts/Piper fallback)         | Codex | in review |
| [ ]  | Demo: ffmpeg assembly (captions, title card, end card) → `pnpm demo:video`          | Codex | in review |
| [ ]  | Demo: optional CI job steps                                                         | Codex | blocked   |
| [ ]  | Demo: Higgsfield replacement-film script and production brief for Claude Code       | Codex | in review |

## Phase 3 — Integration (Claude Code)

| Done | Task                                                             | Owner       | Status |
| ---- | ---------------------------------------------------------------- | ----------- | ------ |
| [x]  | Review and merge `codex/*` PRs                                   | Claude Code | done   |
| [x]  | Wire `ats` into `/api/score` (timeouts, caching)                 | Claude Code | done   |
| [x]  | Wire `parsers` into extension and check page                     | Claude Code | done   |
| [x]  | End-to-end Playwright test of the main flow (separate from demo) | Claude Code | done   |

## Phase 4 — Final demo and launch

| Done | Task                                                             | Owner       | Status |
| ---- | ---------------------------------------------------------------- | ----------- | ------ |
| [x]  | Record final demo video against extension + deployed web app     | Codex       | done   |
| [x]  | Security review + hardening (extension best practices, web API)  | Claude Code | done   |
| [x]  | Root CI: optional demo job steps (per `demo/README.md`)          | Claude Code | done   |
| [x]  | Release workflow (extension zip on `v*` tags)                    | Claude Code | done   |
| [ ]  | Lighthouse + accessibility pass; error and empty states          | Claude Code | todo   |
| [ ]  | Final README (Mermaid diagram, setup, live link, embedded video) | Claude Code | todo   |
| [ ]  | Chrome Web Store submission                                      | Owner       | todo   |

## Phase 5 — Improvement plan (`docs/improvement-plan.md`)

| Done | Task                                                                                    | Owner       | Status    |
| ---- | --------------------------------------------------------------------------------------- | ----------- | --------- |
| [ ]  | M1 unbreak: e2e from fresh clone, sign-in options, check-page resume, install CTA, undo | Claude Code | in review |
| [ ]  | M1: core-flow gaps (follow-up dates, notes, manual add, filters, panel next steps)      | Claude Code | in review |
| [ ]  | M1: `buttons.spec.ts` permanent click-through test                                      | Claude Code | in review |
| [ ]  | M2 (partial): tokens with dark mode, landing refresh, icons and link previews           | Claude Code | in review |
| [ ]  | M2/M3: design direction, shadcn/ui primitives, full surface redesign                    | Claude Code | blocked   |
| [ ]  | Board parsers for LinkedIn, Indeed, Workday, Wellfound (B6b)                            | Codex       | todo      |
| [ ]  | Sign-in keys (Google, Resend), `ANTHROPIC_API_KEY`, `EXTENSION_STORE_URL` in Vercel     | Owner       | todo      |

## Add-on rollout — Codex (2026-10-15)

- [ ] Codex: employer-source finder, synced shortlist/preferences/facts, calendar/templates, prior-save notices, comparisons, analytics and CSV portability — implementation and validation in progress; see docs/addon-rollout.md.
- [ ] Codex: interview preparation and coach workspace — queued; coach access requires owner approval.
- [ ] Codex: scheduled monitoring — deferred by owner; do not activate.

## Cloud extension reliability — Codex (2026-10-15)

- [x] Codex: navigation/retry generations, current-URL message validation, stale-response protection and bounded API requests — PR #31; 17 new unit regressions and one new browser regression; 219 package tests, 10 functional browser tests and production artifact checks pass. Initial access blockers resolved; see the appended HANDOFF entries for exact checks and #24 integration notes.
