# Decisions

Append-only log of notable choices and why. Dated and signed.

---

### 2026-10-14 [Claude Code] Phase 1 stack

- **Database: Neon Postgres** (owner's choice) with Drizzle ORM. First-class Vercel integration; plain connection string.
- **Auth: Auth.js with GitHub sign-in only** (owner's choice). No email provider to configure. Magic link can be added later.
- **TypeScript pinned to 6.0.x.** TypeScript 7 is released, but typescript-eslint supports `<6.1`. Revisit when typescript-eslint adds TS 7 support.
- **Internal packages ship TypeScript source** (`exports: ./src/index.ts`), no build step. Fewer moving parts; Next.js `transpilePackages` and WXT/Vite compile them.
- **Extension framework: WXT** (MV3, Vite-based, side panel support, predictable `.output/chrome-mv3` path for Playwright).
- **Repo lives outside OneDrive** (`C:\Users\jkara\code\real-role` on the owner's machine) to avoid syncing `node_modules`.

### 2026-10-14 [Claude Code] Contract design

- **Signals carry `impact` and `maxImpact`.** Score = sum of impacts, so every point traces to a visible signal (A2). Unavailable signals have `available: false`, impact 0, and reduce confidence; the remaining weights are renormalized so missing data doesn't drag the score down (A3).
- **Two fingerprints.** `fingerprint` (title + company + description, digits removed) detects identical reposts; `roleKey` (title + company + location) groups reposts whose description was tweaked. Both are pure 64-bit FNV-1a hashes in `@real-role/shared` so the extension, API and demo seed agree.
- **Dates are ISO strings on the wire,** validated with zod.
- **`/api/score` takes a discriminated union** (`parsed` from the extension, `url` or `text` from the check page). `url` mode fetches only the single URL the user submitted, once; no crawling (A2).
- **Added `PATCH`/`DELETE /api/applications/:id`** beyond the brief's GET/POST, so the dashboard can update status and remove items without a later contract change.
- **`testids.ts` lives at `packages/shared/src/testids.ts`** (brief says `packages/shared/testids.ts`); exported as `@real-role/shared/testids` and from the package root.
- **ATS adapters take an optional `AtsContext`** (`fetch` + `AbortSignal`) as a second argument, so tests can inject mocks and the API can enforce timeouts. The brief's one-argument signatures still work.

### 2026-10-15 [Claude Code] Scoring engine (`scoring-1`)

- **Weights:** age 30, repost history 25, careers page 25, description detail 15, hiring activity 5 (brief: high/high/high/medium/low–medium). Bands: high ≥ 70, medium ≥ 40.
- **Integer points that sum exactly to the score** (largest-remainder rounding, capped at each signal's maximum), so the UI can show "points earned of points possible" with no rounding drift.
- **Repost history uses the observation span, not raw count.** Many sightings within 14 days mean a popular posting, not a repost, so they're never penalized. A single first sighting counts at half reliability for confidence.
- **An empty ATS board is "unknown", not a miss,** because the adapters can't tell an empty board from a failed lookup (per Codex's `packages/ats` README).
- **The LLM rubric is blended 50/50 with heuristics** rather than replacing them, so the score stays explainable and stable if the model is unavailable. The prompt and reply validation live in `packages/scoring`; the API call and the model choice live in `apps/web` (Phase 3).
- **Native Chrome side panel** for the extension, plus a standalone render of the panel page for demo capture (see HANDOFF 2026-10-15).
