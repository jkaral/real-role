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
| [ ]  | ATS adapter: Greenhouse (public Job Board API) + msw tests                          | Codex | in review |
| [ ]  | ATS adapter: Lever (public Postings API) + msw tests                                | Codex | in review |
| [ ]  | ATS adapter: Ashby (public Job Postings API) + msw tests                            | Codex | in review |
| [ ]  | `detectBoard` + fuzzy `findMatch` (title + location)                                | Codex | in review |
| [ ]  | Parser: generic JSON-LD `JobPosting` fallback (`parseGeneric`)                      | Codex | in review |
| [ ]  | Parsers: board-specific (Greenhouse, Lever, Ashby hosted pages; others as feasible) | Codex | in review |
| [ ]  | Scoring edge-case tests in `packages/scoring/test/edge/**` (after scoring lands)    | Codex | in review |
| [ ]  | Demo: three fictional fixture pages with JSON-LD (high / low / medium)              | Codex | in review |
| [ ]  | Demo: seed observations for repost history                                          | Codex | blocked   |
| [ ]  | Demo: Playwright recorded run with extension, assertions, click highlight           | Codex | blocked   |
| [ ]  | Demo: narration script + TTS (ElevenLabs/OpenAI or edge-tts/Piper fallback)         | Codex | in review |
| [ ]  | Demo: ffmpeg assembly (captions, title card, end card) → `pnpm demo:video`          | Codex | in review |
| [ ]  | Demo: optional CI job steps                                                         | Codex | blocked   |

## Phase 3 — Integration (Claude Code)

| Done | Task                                                             | Owner       | Status    |
| ---- | ---------------------------------------------------------------- | ----------- | --------- |
| [x]  | Review and merge `codex/*` PRs                                   | Claude Code | done      |
| [x]  | Wire `ats` into `/api/score` (timeouts, caching)                 | Claude Code | done      |
| [ ]  | Wire `parsers` into extension and check page                     | Claude Code | in review |
| [ ]  | End-to-end Playwright test of the main flow (separate from demo) | Claude Code | in review |

## Phase 4 — Final demo and launch

| Done | Task                                                             | Owner       | Status |
| ---- | ---------------------------------------------------------------- | ----------- | ------ |
| [ ]  | Record final demo video against extension + deployed web app     | Codex       | todo   |
| [ ]  | Lighthouse + accessibility pass; error and empty states          | Claude Code | todo   |
| [ ]  | Final README (Mermaid diagram, setup, live link, embedded video) | Claude Code | todo   |
| [ ]  | Chrome Web Store submission                                      | Owner       | todo   |
