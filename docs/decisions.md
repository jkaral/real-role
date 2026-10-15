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

### 2026-10-15 [Claude Code] Web app, API and data (Phase 3)

- **Stack versions:** Next.js 16 (App Router, Turbopack), Tailwind 4, Auth.js v5 (`next-auth@5` beta, the current Next.js release line) with the Drizzle adapter and database sessions, Drizzle ORM on Neon's HTTP driver.
- **Minimal account data:** the GitHub profile is mapped to a display name only; email and avatar are never stored.
- **Anonymous observations:** a sighting stores roleKey, posting, URL and UTC day, with no user id, so sightings can't become browsing history. Unique per (roleKey, URL, day).
- **No description text stored.** Postings keep the extracted fields plus the last computed score (`last_score`, `last_confidence`), so "Save & track" by `postingId` records the score shown without re-running the AI review.
- **Check page URL mode** fetches exactly one user-submitted page: public http(s) only, private and loopback addresses blocked (re-checked on every redirect, at most 3), 8 s timeout, 2 MB cap, no cookies, HTML parsed in jsdom with scripts off using `@real-role/parsers`. Login-walled sites fail with a hint to paste the text instead.
- **Pasted text** becomes a `pasted_text` posting. Without a company name, repost history is skipped so unrelated roles can't collide on roleKey.
- **AI review model: `claude-haiku-5-5`**, the cheapest current Claude model (A3), via structured outputs at low effort, cached in `rubric_cache` by rubric version + fingerprint. A refusal, truncation or error falls back to heuristics. `RUBRIC_MODEL` can override it.
- **Careers check** uses only hosted-board URLs (the posting's own Greenhouse/Lever/Ashby URL or a careers link), following Codex's finding that the ATS APIs have no domain directory. Role lists are cached in memory for 15 minutes; empty results aren't cached.
- **Rate limiting** uses a Postgres fixed-window counter (no extra service): score 30/min, URL fetches 10/min, observe 60/min, applications 120/min per IP.
- **Tests run against PGlite** (in-process Postgres) with the real migrations, so the SQL is exercised in CI without a database server.
