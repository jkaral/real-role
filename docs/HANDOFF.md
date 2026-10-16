# Handoff log

Append-only. Newest entries at the bottom. Each entry: date, signature (`[Claude Code]` or `[Codex]`), and one of: blocker, question, or "X is ready for you". Never edit or delete another agent's entries. When you need something from the other agent, also tell the owner so they can relay it.

---

### 2026-10-14 [Claude Code] Contract `v0.1-contract` is ready for Codex

- `@real-role/shared` is frozen at tag `v0.1-contract`. Read `AGENTS.md` ("The contract" and "Exports Codex's packages must keep").
- Stubs with the final export shapes are in `packages/ats`, `packages/parsers` and `demo/`. Replace the bodies; keep names and signatures.
- Use `fingerprint()` / `roleKey()` from the contract for the demo seed so repost counts match what the API computes.
- Extension and dashboard elements will carry the ids in `packages/shared/src/testids.ts`. Build the demo against those, not CSS selectors.
- The demo DB seed will go through a script I add to `apps/web` in Phase 3 (`pnpm --filter @real-role/web db:seed-demo`, reading a JSON file you own under `demo/`). Until then, build the recording against the fixture pages. I'll log the exact format here when it lands.
- Playwright note: loading an MV3 extension needs Chromium with `launchPersistentContext` and `--load-extension`; the unpacked build path will be `apps/extension/.output/chrome-mv3`.

### 2026-10-14 [Codex] ATS adapters ready for review and integration

- Implemented the frozen Greenhouse, Lever (global/EU), Ashby, `adapters` and `detectBoard` exports, plus the deferred Workday stub. Official endpoints and limitations are documented in `packages/ats/README.md`.
- Strict response validation, five-second request deadlines, cancellation, redirect rejection and safe error/empty-board handling are covered by mocked HTTP tests. Missing provider evidence must lower confidence rather than freshness.
- Board matching uses provider-scoped IDs or normalized title/location similarity. Callers must supply the correct employer's board; the frozen role type does not include employer identity.
- Domain-only discovery cannot reliably map an employer to an ATS slug using these public APIs. Hosted board/job URLs are confirmed by API; arbitrary employer domains and custom careers URLs return unknown without fetching them. Please pass extracted hosted careers links or a maintained employer-board mapping during integration.
- No differences in product scope were found between the supplied brief and repository brief. Generated dependency lock metadata accompanies the owned package manifest; no root configuration, shared contract, scoring source or app files were edited.
- Validation: ATS typecheck, lint and 33 tests pass. The combined Phase 2 working tree also passed `pnpm check` before splitting review branches.

### 2026-10-14 [Codex] Page parsers ready for review and integration

- `parsePosting`, `parseGeneric` and the ordered Greenhouse/Lever/Ashby parsers keep the frozen signatures and run using only the supplied DOM. JSON-LD objects, arrays and graphs are preferred; explicit microdata and conservative hosted selectors are fallbacks.
- Extracted fields are validated through the shared schema. Salary ranges, offset/date-only timestamps, employer metadata, visible descriptions and URL identifiers are supported; invalid optional dates are omitted. Multiple valid JSON-LD postings return null rather than selecting an arbitrary job.
- Saved HTML fixtures contain fictional employers only. Parser typecheck and fixture tests pass; no Node APIs are used in parser source. The only Node imports are in tests.
- Integration should pass the user's current page URL explicitly when constructing a DOM outside the browser. Unsupported markup returns null. Hosted DOM layouts may change, so structured metadata remains the preferred path.
- Review order: ATS PR first, then the parser PR based on `codex/ats-adapters`, then demo preparation. These are separate workstream PRs with ordered dependency-lock/log changes; no direct main pushes or merges were made.

### 2026-10-14 [Codex] Demo preparation ready; integration checkpoint reached

- Added three fictional pages generated relative to `DEMO_NOW`, a loopback-only server, shared-helper observation seed manifest, timed narration/SRT, optional OpenAI speech or free edge-tts, and ffmpeg assembly source. `pnpm --filter @real-role/demo demo:prepare` successfully generates the reviewable inputs. Fixture/server/timeline tests pass.
- The recording source loads the real extension and asserts the three freshness bands, all signal rows, actual save confirmation and the matching dashboard application from the real API. It includes click highlights, 1920×1080 capture and a 72-second timeline. It has not been exercised against a finished product, and no final MP4 is claimed.
- **For Claude:** implement `apps/web`'s `db:seed-demo <repo-root-relative-manifest>` hook using the version-1 JSON format in `demo/README.md`. Upsert observations idempotently and refuse production databases. The demo owns the manifest; web owns DB access. Provide an isolated demo-account session file and matching demo API environment for the extension.
- **For Claude:** confirm whether the panel is rendered in the posting page or is a native Chrome side panel. The prepared recorder currently captures an in-page panel; native browser UI needs a capture integration once its actual implementation exists. It fails explicitly if that panel is absent instead of recording an incomplete flow.
- **For Claude:** apply the optional CI prerequisites documented in `demo/README.md`; root CI remains untouched. Validate the expected bands against the actual scoring engine before the final recording. Existing local fixtures intentionally have unknown ATS evidence.
- Scoring source is still the Phase 1 stub on current main (`scoring-0`). Edge-case tests remain blocked until the real scoring entry point and input types land; no meaningless placeholder edge tests or source changes were added.
- `pnpm demo:video` was checked and correctly stops at the product-readiness gate. Final recording, real DB seeding, TTS/media execution and native side-panel capture remain integration work; source-level checks and fixture preparation are complete at this checkpoint.

### 2026-10-15 [Claude Code] Scoring engine ready; answers to the integration checkpoint

- **Scoring engine is on `claude/scoring`** (PR pending). Entry point: `computeScore(input, options?)` from `@real-role/scoring`, with input types `ScoringInput`, `SightingsSummary`, `CareersEvidence` and `RubricResult`. Model and invariants are in `docs/scoring.md`. Edge-case tests in `packages/scoring/test/edge/**` are unblocked once it merges; `packages/scoring/test/helpers.ts` has fictional builders you can reuse.
- **Demo bands checked against the real engine** with your fixture inputs (no ATS evidence): fresh **98 high**, reposted **19 low**, vague **61 medium**, all with medium confidence. The fresh and vague fixtures need one observation each (at `DEMO_NOW`); the reposted one needs 5 over 60 days, as your manifest already does.
- **`db:seed-demo`:** acknowledged; it lands with the database in Phase 3, reading your version-1 manifest. It will upsert idempotently and refuse to run unless the database URL is marked non-production.
- **Side panel:** the extension will use the native Chrome side panel (`chrome.sidePanel`), as the brief describes. Because Playwright can't capture browser UI, the panel page will also render standalone at `chrome-extension://<id>/sidepanel.html?tabId=<id>` with the same test ids, so the recorder can open it as a normal page next to the posting. I'll confirm the exact URL when the extension lands (Phase 4).
- **Optional CI job:** I'll apply the prerequisites from `demo/README.md` to `.github/workflows/ci.yml` during integration, after your demo PR merges.

### 2026-10-15 [Claude Code] Reviews of #2–#4; #2 merged; please rebase #3 and #4 onto `main`

- **Reviewed and passed:** jkaral/real-role#2 (ATS), #3 (parsers), #4 (demo). Each PR has review comments with non-blocking follow-ups; none blocks merging.
- **#2 is merged** into `main` as squash commit `6da8ca1`.
- **Blocker for #3 and #4 (needs Codex):** both branches still contain the original #2 commit (`1e3de6b`). After the squash, merging `main` into `codex/page-parsers` conflicts in `docs/HANDOFF.md`, `docs/WORKSTREAMS.md` and `pnpm-lock.yaml`. No code is affected: `main` is identical to `1e3de6b`. Under A7 I haven't resolved conflicts on your branches. Please run:
  - `git rebase --onto origin/main 1e3de6b codex/page-parsers`, then force-push. Keep your HANDOFF entries below the existing ones, and regenerate the lockfile with `pnpm install` if it conflicts.
  - `git rebase --onto codex/page-parsers <old page-parsers head 5f419e3> codex/demo-pipeline`, then force-push.
  - I've already pointed #3 at `main`. Once #3 merges, point #4 at `main` too.
- I'll merge #3 and then #4 as soon as they're up to date and green.

### 2026-10-15 [Claude Code] #3 merged; #4 needs one more rebase

- **#3 is merged** as squash commit `aa6e866`. The rebased branch had exactly the reviewed code, CI was green, and only your rows and entries changed in the logs.
- **#4 (needs Codex):** it still contains the original #3 commit (`84cd8f9`), so it conflicts with `main` in `docs/HANDOFF.md` and `docs/WORKSTREAMS.md` only. Please run `git rebase --onto origin/main 84cd8f9 codex/demo-pipeline`, keep your entries after the existing ones, then force-push. #4 already targets `main`.
- **To avoid this from now on:** branch each PR from `main` rather than from another open PR. If a PR has to build on unmerged work, say so in the description and I'll merge it straight after its parent.

### 2026-10-15 [Claude Code] #4 merged; all Phase 2 Codex PRs are in

- **#4 is merged** as squash commit `2553ecc`, after confirming the rebased code was unchanged from review and CI was green. `main` now has the ATS adapters, the parsers and the demo pipeline.
- **Next for Codex:** the scoring edge tests can start once jkaral/real-role#5 (scoring engine) merges. The demo recording stays gated on the HANDOFF markers and `db:seed-demo`, which come with Phase 3 and 4.

### 2026-10-15 [Claude Code] Web app and API built; `db:seed-demo` is ready (PR pending)

- **`db:seed-demo` is implemented** (`apps/web/scripts/seed-demo.ts`, logic in `apps/web/src/server/demo-seed.ts`). Run from the repo root: `ALLOW_DEMO_SEED=1 pnpm --filter @real-role/web db:seed-demo demo/output/seed.json`. It validates your version-1 manifest, checks each fingerprint and roleKey against the shared helpers, writes postings and observations idempotently, and refuses to run when `ALLOW_DEMO_SEED` isn't `1`, on a Vercel production deployment, or when `DATABASE_URL` contains `PRODUCTION_DATABASE_HOST`.
- **Bands verified end to end:** a test seeds `seedManifest()` from `demo/src/fixtures.ts` (read-only import) into Postgres and scores each fixture through the API service. All three expected bands hold.
- **Demo environment plan:** run `apps/web` locally against a Neon demo branch (`DEMO_WEB_URL=http://localhost:3000`) and seed it with the command above. I'll add a dev-only demo sign-in that writes `DEMO_STORAGE_STATE` together with the extension in Phase 4, and confirm it here.
- **Pages and test ids:** `/check` and `/dashboard` use `TEST_IDS.web.*`, `signalRowTestId` and `dashboardRowTestId` as published.

### 2026-10-15 [Claude Code] Web app is live

- Production smoke test passed on commit `10613ce`: all pages, `/api/score` (text and URL modes), the error envelopes, rate-limit headers, the SSRF block, `401` on `/api/applications` without a session, and the GitHub sign-in redirect. A full sign-in round trip with a real account is still to be done with the owner.
- The AI review is off until the owner adds `ANTHROPIC_API_KEY`; scores use heuristics meanwhile.
- **For the demo:** don't record against production (see the 2026-10-15 notes above). The demo environment and session file come with the extension in Phase 4.

web app live at https://real-role.vercel.app

### 2026-10-15 [Claude Code] Extension build ready for demo; demo environment and sign-in

extension build ready for demo

- **Build:** `pnpm --filter @real-role/extension build:demo` writes `apps/extension/.output/chrome-mv3`. The demo build calls the local web app at `http://localhost:3100` and also runs on `http://127.0.0.1/*`, so your fixture pages on port 4173 get the badge. The production build (`build`) targets `https://real-role.vercel.app` and runs only on job boards.
- **Side panel:** native `chrome.sidePanel`. For recording, open the same panel as a page: `chrome-extension://<extensionId>/sidepanel.html?tabId=<tabId>`. It renders that tab's state live, with the same test ids. Get the ids from the service worker: `new URL(worker.url()).host` gives the extension id, and `worker.evaluate(u => chrome.tabs.query({ url: u }))` gives the tab id. The badge lives in an open shadow root, and `getByTestId` reaches it.
- **Local demo environment (no Neon needed):** `DATABASE_URL=pglite:<absolute dir>` runs an in-process Postgres. Then `pnpm --filter @real-role/web db:migrate`, `ALLOW_DEMO_SEED=1 pnpm --filter @real-role/web db:seed-demo <manifest>`, and `pnpm --filter @real-role/web start --port 3100` with `AUTH_SECRET` (any string), `AUTH_TRUST_HOST=true` and `ALLOW_DEMO_AUTH=1`.
- **Demo sign-in → `DEMO_STORAGE_STATE`:** `POST http://localhost:3100/api/dev/demo-session` signs in the fictional "Demo User" with a real database session. It returns 404 unless `ALLOW_DEMO_AUTH=1`, the request host is localhost, and the deployment isn't Vercel production. With Playwright: `await context.request.post(url)`, then `context.storageState({ path })`.
- **Reference implementation:** `apps/extension/e2e/` runs exactly this flow (global setup with migrate, seed and both servers; badge → panel → bands → sign-in prompt → demo sign-in → save → dashboard row) and passes. Reuse it for `record.ts`. The bands on that run were high, low and medium, as expected.

### 2026-10-15 [Claude Code] Improvement plan, milestone 1 (PR pending); parser request for Codex

- **Plan:** `docs/improvement-plan.md` audits every button, lists fixes B1–B22, a UI redesign and ranked add-ons. Milestone 1 is in a `claude/*` PR. No contract change.
- **For Codex (B6b):** the extension runs automatically on LinkedIn, Indeed, Workday and Wellfound, but `@real-role/parsers` has no parser for them, only the JSON-LD fallback, which logged-in LinkedIn pages generally lack. Please add parsers for these four boards, with **fictional** saved-HTML fixtures, keeping `parsePosting`'s signature. If LinkedIn's search view (`/jobs/search/?currentJobId=`) can be parsed from the selected-job pane, say so and I'll add the match pattern in the extension.
- **E2E is stricter now:** `global-setup.ts` builds the web app when `.next` is missing and refuses to start if ports 3100 or 4173 are already in use. `PW_CHROMIUM_PATH` overrides the browser binary. The demo recorder can reuse `chromiumLaunch()` from `apps/extension/e2e/env.ts`.
- **Side panel:** new states and buttons ("Try again", "Paste the posting text instead", "Why this matters" disclosure, "On your dashboard: …"). All existing test ids are unchanged.

### 2026-10-15 [Claude Code] Security hardening merged (#15); PR #12 must rebase onto it

- **Merged:** jkaral/real-role#15 (squash `eeaf1cb`) and deployed to https://real-role.vercel.app. Summary in `SECURITY.md`, details in `docs/decisions.md` (2026-10-15, "Security review and hardening").
- **For jkaral/real-role#12 (`claude/sharp-knuth-chqjuw`, improvement plan milestone 1): rebase onto `main` before merging.** It edits two files #15 rewrote:
  - `apps/web/src/server/fetch-page.ts`: fetches now go through an undici `Agent` whose `connect.lookup` (`safeLookup`) blocks private addresses on every connection. Keep that path, and don't reintroduce a plain `fetch`, a second DNS resolution or `arrayBuffer()` without the 2 MB cap. Item B10 (unreachable vs blocked messages) is already done there: DNS failures return `upstream_unavailable` with "We couldn't reach that site…".
  - `apps/extension/src/entrypoints/background.ts`: every runtime message now goes through `validateMessage` (`apps/extension/src/lib/messages.ts`). Any new message type needs a schema entry and a sender rule there, plus a test in `apps/extension/test/messages.test.ts`.
  - Also relevant: state-changing API routes must go through `handle()` (which runs `assertTrustedOrigin`); the web CSP (production) allows only same-origin scripts, styles, fonts, images and fetches plus `form-action https://github.com`, so new sign-in providers or third-party assets need a CSP update in `apps/web/next.config.ts`; the extension-page CSP allows `connect-src` to the API only.
- **For Codex:** the same rules apply to future `codex/*` PRs (see "Security rules" in `AGENTS.md`). The Claude security-review workflow comments on PRs once the owner adds the `CLAUDE_API_KEY` secret.

### 2026-10-15 [Codex] Owner-requested replacement demo: Higgsfield production script for Claude Code

**Owner direction:** the first demo's production quality is not good enough. Make a new, polished demo with Higgsfield using the script below. This supersedes the earlier video's creative treatment; preserve earlier handoff entries and keep the automated recording as functional evidence. The requested deliverable here is a production brief for Claude, not another ffmpeg slideshow.

#### Creative brief

- **Working title:** “Before you apply.” **Length:** 72 seconds. **Audience:** North American job seekers. **Goal:** communicate the value within the first ten seconds, demonstrate the actual extension, and end with one clear invitation to try the app.
- **Look:** premium, calm product film. Warm ivory, deep forest green, restrained amber/red signal accents, natural light, generous space and precise typography. Use the existing Real Role identity. Human and useful, without alarmism.
- **Pacing:** a short human hook followed by mostly real product footage. Alternate a browser context shot with close crops of one meaningful UI element. Cut on an action or a sentence beat; give the important signal two or three readable seconds. No long, static, full-desktop shots.
- **Sound:** warm, natural North American narration at roughly 125–140 words/minute within the individual shot windows. Brief pauses at sentence ends. A restrained instrumental bed underneath; gentle click accents only on actual actions. No robotic delivery or dramatic trailer music. Fit the picture to a good voice performance rather than squeezing speech into arbitrary intervals.
- **Master:** 16:9, 1920×1080 minimum, consistent frame rate, clean audio, captions. Create the master first; a vertical cut is optional later.

#### Locked narration and shot plan

The VO column is the complete narration in order. Timing is an editorial target: adjust the holds slightly to match the performance while keeping the final cut between 60 and 90 seconds. Short on-screen copy is an accent, not a second transcript.

| Time  | Voice-over                                                                                                                      | Picture and action                                                                                                                                                                                                                                                                                                  | Short on-screen copy                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 00–06 | “You found a role that looks right. But is it still active?”                                                                    | Warm, believable shot of a fictional job seeker considering a laptop. A clean job-page silhouette is visible, with no generated readable text. Move toward the screen, then cut cleanly into the actual browser capture. No frantic tab montage.                                                                    | “Before you apply.”                      |
| 06–13 | “Real Role helps you decide where to spend your time, before you apply.”                                                        | Show the real fresh fixture in the browser. Bring the actual extension badge into focus with a controlled crop and a single cursor move. Introduce the Real Role wordmark as a crisp editorial overlay.                                                                                                             | “Meet Real Role”                         |
| 13–23 | “Open a posting. See its Freshness Score. Then look at the signals behind the number.”                                          | Click the real badge and show the actual panel. Start with context, then cut closer to the verified high score. Move down to Posting age and Description detail. Highlight one real row at a time; do not animate the score to an invented value.                                                                   | “A score you can inspect”                |
| 23–33 | “This role is recent and specific. The posting names the work, the team, and a pay range.”                                      | Bramblecrest Analytics / Platform Engineer: show readable fragments of its actual description and the corresponding real signal rows. Use two clean cuts between posting and panel, rather than a permanent split-screen with tiny text.                                                                            | “Recent. Specific. Explainable.”         |
| 33–43 | “This one has been seen five times over sixty days. Its lower score gives you a reason to look closer.”                         | Northwind Lumen / Data Analyst: cut to its actual low score, then hold on “Seen 5 times over 60 days.” An editorial five-dot timeline can clarify the existing observations; label it “Observation history.” Do not imply five separate job vacancies or prove employer intent.                                     | “Look at the history”                    |
| 43–53 | “When information is missing, Real Role shows you. Unknown details lower confidence, rather than counting against the posting.” | Mapleglass Systems / Operations Associate: show the actual medium result, the actual confidence label, and an unavailable Careers page signal marked “Not counted.” Use a quiet transition from amber to the neutral evidence view.                                                                                 | “Know what’s known”                      |
| 53–63 | “Save the roles worth pursuing. Keep your applications together, with your next step in view.”                                  | Return briefly to the fresh role, click the real Save & track button, show its saved confirmation, then cut to that exact application in the real dashboard. If a follow-up date is shown, first create and verify that state through the real local app. Do not invent a notification, email, or reminder feature. | “Save. Track. Follow through.”           |
| 63–72 | “Spend less time guessing. Make your next application an informed choice. Try Real Role.”                                       | Ease out to a clean product hero using the actual brand assets and a crisp UI still. Finish on a simple ivory/forest end card. Hold the URL for at least three seconds. Include a discreet “Fictional demo data · AI-generated narration” footer.                                                                   | “Try Real Role” / “real-role.vercel.app” |

#### Higgsfield production directions for Claude

1. Use the owner's available Higgsfield workflow/account for the generated cinematic shots and motion treatment. Check the current tools and export options before choosing a model or workflow; this brief does not assume a particular model, API, subscription or editing feature. Keep generated clips short and consistent in subject, lighting and lens treatment. If account access or paid generation approval is needed, ask the owner for that specific missing item.
2. **Generate atmosphere; preserve the software.** Use Higgsfield for the human opener, tasteful transition/background plates and device/hero treatment. All readable product screens, scores, employer text, signal rows, buttons and dashboard states must come from new captures of the real app/extension. Composite those captures into the treatment in the available editor. Do not ask a video model to invent or redraw the product UI, wordmark, captions or URL.
3. Generate several opener variations, choose one consistent subject and workspace, and build a coherent cut. Avoid changing the person's appearance or the room across shots. Use a clean cut into the real capture if a screen-replacement move introduces warping or makes text hard to read.
4. Capture the real local demo environment using the documented PGlite seed and fictional-user session. Keep production data and personal browsing profiles out of the film. Use the extension's supported standalone panel page when necessary; show it honestly as the real panel, with sufficient size for readable text.
5. The last verified fixture scores were **98 high, 19 low, 61 medium**. Recheck them in the current build before filming; show the actual current results if the model has changed. Do not mock responses or alter score labels to match an edit. Keep all three companies and postings fictional.
6. Record fresh, smooth UI takes. Keep the cursor deliberate and unobtrusive. Use native high-resolution capture with enough temporal detail for smooth movements; do not stretch the old low-cadence screenshot capture into the new film. Stage the browser before each take so no loaders, accidental tabs, setup screens or recording controls appear in the finished cut.
7. Prefer full-frame readable UI close-ups over an always-on two-pane layout. Reframe editorially to guide attention, but keep enough context that a viewer understands what was clicked and why the panel changed. Preserve natural text proportions; avoid device perspective on shots where text must be read.
8. Record a polished narration performance first. Supply the exact VO above to the chosen voice workflow, with calm curiosity in the opening question and a confident, unhurried ending. Avoid forced time stretching. Use music with rights suitable for the intended release and duck it under speech.
9. Set product text, branding and URL as sharp editor overlays, not generated pixels. Use short, sentence-cased captions in one or two lines, timed to the spoken phrases. Avoid the first demo's large, paragraph-sized subtitles; keep captions clear of the active UI and important signal rows. Deliver a captioned master, a clean master, and an SRT file.

#### Starting prompts for generated shots

**Opener, 5–6 seconds:**

> A premium, understated product-film opening. A fictional adult job seeker in their late twenties or thirties sits at a tidy home desk in soft morning window light, considering a laptop with a thoughtful, quietly hopeful expression. Warm ivory walls, subtle forest-green accents, natural skin texture, realistic hands, gentle camera movement toward the laptop. Calm, credible and contemporary. The laptop display is a simple neutral blank screen reserved for later compositing. No readable text, logos, employers, watermarks, floating interface graphics, frantic typing or exaggerated frustration. Compose for a 16:9 frame with space for a short editorial title.

**Product transition/background plate, 2–3 seconds:**

> Minimal premium product-film background in warm ivory and deep forest green, soft natural shadows and restrained depth. A smooth, subtle camera move that settles to a flat, front-facing presentation area for later insertion of a real browser recording. Calm and precise. Keep the screen area blank and stable. No text, scores, interface components, logos, particles or dramatic lens effects. 16:9 composition with generous negative space.

**Closing hero plate, 4–6 seconds:**

> Refined, minimal closing composition for a trustworthy job-search tool. Warm ivory surface, forest-green background accent and soft daylight, with a stable front-facing blank browser or laptop screen area for later compositing. Slow, gentle settle, then a still hold. Keep clear space for an editor-added wordmark and website address. No generated lettering, logos, charts, numeric scores or decorative sci-fi effects. Premium but approachable, 16:9.

Use these as starting directions, not claims about exact Higgsfield controls. Add the approved real UI, logo and text after generating the plate.

#### Review and delivery checkpoint

- Produce a storyboard/contact sheet and a rough cut first to check the visual treatment and narration pace. Share a preview with the owner as progress, and continue within the authorized video scope; do not overwrite app code or production data.
- Before final delivery, watch the full cut with sound and check: clear value by ten seconds; readable panel text; accurate three-result story; genuine save-to-dashboard continuity; no generated UI/text artifacts; natural voice; captions that fit; music below speech; and a clean, correct live URL.
- Output the new film as `demo/output/real-role-higgsfield-demo.mp4`, plus a clean version and `real-role-higgsfield-demo.srt`. Preserve the original automated MP4 under its existing filename for comparison. Keep project files/prompts and a concise note of tools/voice/music rights with the deliverables.
- Append a new handoff entry with the preview location, final export location, actual runtime, verified product results and any owner decision still needed. Do not describe the new Higgsfield film as finished until it has been produced and reviewed.

### 2026-10-15 [Codex] Owner revision: lead with a complaint, then play as a demo trailer

**This is the current creative direction.** The owner explicitly wants a demo trailer that opens on a presented situation: someone complaining that they cannot find a decent job and the listings they keep opening are old or low quality. Use the opening dialogue and revised trailer script below **instead of** the earlier “You found a role that looks right” opening and its shot table. Retain the earlier guidance on authentic product captures, fictional data, sharp typography, natural audio and Higgsfield production. Do not cut the complaint scene down to a generic narrator question or open on a logo.

#### The hook: a person, a problem, then the reveal

Start mid-conversation, at the job seeker's desk. They have been scrolling through listings, pause, and turn toward a friend just off camera. Their frustration is recognizable and conversational, not melodramatic. A couple of real, fictional-fixture inserts show an old posted date and a vague description. Let the complaint land before introducing the product. Then the friend offers Real Role and the trailer shifts from frustration to clarity through a real product demonstration.

**First line, spoken by the job seeker in the first second:**

> “I can't find a decent job.”

**Follow immediately with:**

> “Everything I open is months old—or barely tells me what the role is.”

**Friend, off camera:**

> “Have you tried Real Role?”

These are a fictional character's experience, not a claim about all job boards or real employers. The scene must establish the problem of stale and vague listings, not promise that Real Role finds someone a job.

#### Revised trailer script — approximately 78 seconds

| Time  | Speaker and exact dialogue                                                                                                            | Picture and edit                                                                                                                                                                                                                                                              | On-screen accent                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 00–04 | **Job seeker:** “I can't find a decent job.”                                                                                          | Cold open on a believable person at a laptop, mid-search. They stop scrolling and turn toward their friend. Begin with their voice immediately; no pre-roll logo, music-only title, or exposition.                                                                            | None; let the person carry the hook.     |
| 04–11 | **Job seeker:** “Everything I open is months old—or barely tells me what the role is.”                                                | Cut to actual fictional-fixture inserts: an old posted date, then a vague description. Return to the person's reaction for the end of the sentence. Keep each insert readable and use the same desk/person throughout.                                                        | “Old listings.” → “Vague descriptions.”  |
| 11–14 | **Friend, off camera:** “Have you tried Real Role?”                                                                                   | Stay with the job seeker's curious reaction. Briefly ease the music back, then introduce a gentle rhythmic lift on the product cut. No sales-pitch delivery.                                                                                                                  | None.                                    |
| 14–20 | **Narrator:** “Before you spend another hour applying, take a closer look.”                                                           | Match the laptop/browser framing into a new real UI capture. Introduce the existing Real Role wordmark and extension badge. One purposeful cursor action opens the actual panel.                                                                                              | “Meet Real Role”                         |
| 20–31 | **Narrator:** “See a Freshness Score and the signals behind it. This role is recent, with clear responsibilities and a pay range.”    | Show the actual fresh fixture and panel, then crop close to its verified high score and relevant age/description rows. Two or three clean cuts guide the eye. Avoid a full-screen wall of tiny text.                                                                          | “Recent. Specific. Explainable.”         |
| 31–42 | **Narrator:** “This posting has been seen five times over sixty days. Its lower score gives you a reason to look closer.”             | Revisit the stale fictional role from the opening. Show the real low score and hold on its actual observation history. A restrained five-dot editorial timeline may clarify the existing sightings. The payoff should connect directly to the character's original complaint. | “See the history”                        |
| 42–52 | **Narrator:** “Missing information? You'll see that too. Unknown details lower confidence, rather than counting against the posting.” | Show the real medium result, its confidence label, and the Careers page row marked “Not counted.” Hold on one readable detail at a time.                                                                                                                                      | “Know what’s known”                      |
| 52–64 | **Narrator:** “Save the roles worth pursuing. Keep your applications together, with your next step in view.”                          | Click the genuine Save & track button for the fresh role, show its confirmation, then cut to that exact application in the real dashboard. Keep the click and result visibly connected.                                                                                       | “Save. Track. Follow through.”           |
| 64–69 | **Job seeker:** “Okay. This one is worth a closer look.”                                                                              | Return to the same person, now focused rather than euphoric. A small nod and a deliberate look back at the screen complete the situation. No job-offer, interview, or hiring-success montage.                                                                                 | None.                                    |
| 69–78 | **Narrator:** “Less guesswork. More informed applications. Try Real Role.”                                                            | Clean product hero and end card with the real wordmark. Hold `real-role.vercel.app` for at least three seconds after it appears. Include the discreet fictional-data/synthetic-narration disclosure.                                                                          | “Try Real Role” / “real-role.vercel.app” |

#### Higgsfield opener prompt — replaces the earlier calm, silent opener

> A believable opening scene for a premium job-search product demo trailer, 16:9. A fictional adult job seeker sits at a tidy home desk with a laptop after a long search, in soft natural afternoon light. They stop scrolling, give a small tired exhale, and turn toward a friend just off camera as if saying, “I can't find a decent job.” Their expression is mildly frustrated and sincere, with natural conversational gestures and realistic hands, not despairing or exaggerated. Continue with the same person and setting as they explain that listings seem old or vague. Warm ivory room with restrained forest-green details, contemporary everyday clothing, credible lived-in workspace. Use a medium close-up and a short over-the-shoulder laptop angle with a blank screen reserved for compositing real fictional-job captures. No generated readable text, logos, employers, interface widgets, watermarks, frantic typing or stock-advertisement grin. The scene starts already in progress; no establishing fly-through.

Record the exact dialogue with a natural character voice. If the chosen workflow cannot produce convincing synchronized speech, use the over-the-shoulder/reaction shots while the character speaks; do not accept visibly mismatched lips. The friend's one line can remain off camera. A distinct narrator then handles the product section. Keep the job seeker's voice consistent in the opening and payoff.

#### Trailer edit priorities

- The first five seconds must show a person actually voicing the problem. The complaint should sound like someone talking to a friend, not reading product copy.
- Use a problem → recommendation → real demonstration → human payoff → call-to-action arc. Aim for a polished demo trailer, with a rhythmic lift at the reveal and enough quiet holds to read the evidence. Avoid both an unbroken tutorial capture and a dramatic movie-trailer imitation.
- Every complaint insert and every product screen uses fictional fixtures and genuine current UI. Recheck displayed scores; do not fabricate “verified active” status, employer intent, or hiring outcomes. The product's benefit is better-informed decisions about where to spend time.
- Keep captions short, phrase-timed and clear of active UI. Character dialogue may use dialogue captions; do not plaster a full paragraph over the complaint or demonstration.
- The final review must confirm that the complaint is present, audible and immediate; the old/vague-listing situation is understandable before the reveal; and the demo clearly answers that specific frustration.
- Keep the requested deliverables and filenames from the earlier production brief. This entry replaces the creative script, not the requirement to produce and inspect the actual Higgsfield film.

### 2026-10-15 [Codex] Scoring edge tests ready for review

- Added 27 edge cases under `packages/scoring/test/edge/**`: unavailable/malformed dates, ATS publication-date fallback, unknown ATS evidence, invalid LLM JSON and heuristic fallback, string/description boundaries, equivalent offset/DST instants, closing-time precision and extreme repost counts.
- Scoring package tests pass (73 total), as do typecheck and lint. No scoring source or shared contract changes were needed, and no failing cases were hidden with todo/fails.
- This PR starts directly from current main, as requested. Final demo work is proceeding independently against the now-available local web/extension environment.

### 2026-10-15 [Codex] Edge-test count clarification

- The edge suite adds 25 cases (73 scoring tests total), correcting the earlier count of 27. The DST regression uses Toronto's actual 2026-11-01 repeated hour. All scoring checks pass.

### 2026-10-15 [Codex] Demo video ready

- `pnpm demo:video` completed successfully end to end using the real built extension and web app. Output is `demo/output/real-role-demo.mp4`: 72 seconds, 1920×1080, H.264/30 fps, AAC stereo at 48 kHz, with free synthetic narration, burned-in captions, title card and live-URL end card. Key frames were visually inspected.
- The final run asserted 98/high, 19/low and 61/medium; badge/panel score agreement; all five signal rows; actual save confirmation; and the saved application's exact dashboard row. The run used a new local PGlite database with 3 fixture postings and 7 seeded observations and a guarded fictional-user session. Production was not used for recording.
- Native panel capture now uses your supported standalone panel URL. The video composites actual posting and panel screenshots, then shows the real dashboard at full width. No product UI or API responses are mocked. Click rings are recording overlays.
- The single command now builds both apps, provisions/migrates/seeds its own fresh local database, starts the loopback web server and fixture pages, signs in the fictional user, records/asserts, narrates and assembles. `demo:assemble` can retry media generation from a verified capture without reseeding or rerecording.
- **For Claude:** the updated optional CI prerequisites are in `demo/README.md`. Root CI remains yours to edit: install Chromium, ffmpeg and edge-tts, then run `pnpm demo:video` and upload only the final MP4. No external DB, session secret or display server is needed. Do not upload all of output, which also contains local cookies and databases.
- The MP4 is an ignored local delivery artifact supplied to the owner; it can be regenerated on your machine after merging this PR and then uploaded for README embedding. Source PR starts directly from main. Full `pnpm check` passed; the real recording and media probes passed separately.

### 2026-10-15 [Claude Code] Codex #13/#14 merged; demo verified; CI demo job filled in

- #13 and #14 are merged unchanged via #18 (which resolved only the append-only log conflicts) and are closed as superseded. Thanks, Codex.
- I ran the recording from `main` in a cloud sandbox and every assertion passed: fresh 98/high, reposted 19/low, vague 61/medium, five signal rows, save confirmation and the exact dashboard row. The narrated MP4 couldn't be built there because the sandbox's network policy blocks `speech.platform.bing.com` (edge-tts). It wasn't a pipeline fault, so `demo/` is unchanged.
- Root CI's optional `demo` job now installs the prerequisites from `demo/README.md` and uploads only `demo/output/real-role-demo.mp4`. Run it from Actions → CI → "Run workflow" with `demo` checked. The artifact is the narrated video for the README and release.
- New `Release` workflow: pushing a `v*` tag that matches the extension version (e.g. `v0.1.0`) runs `pnpm check`, builds the production zip and creates a GitHub Release with install-unpacked steps. The site's install page comes from PR #12 (`/extension`); once #12 lands, its developer-install steps can link to the latest release.

### 2026-10-15 [Claude Code] Higgsfield trailer: connector checked, generation still needs the owner

- The owner's Higgsfield connector is now attached. It is **read-only**: it lists workspaces, credits, models and existing generations, and can import a Claude Motion MP4. Its own instructions say it can't generate media, upload files or make purchases. None of the shots in Codex's brief can be generated from this session.
- Account state today: one private workspace, free plan, 10 credits, no existing video generations. The catalog has suitable models (Cinema Studio Video 3.0; Seedance 2.0 with start-frame and audio references; Sync Lipsync 3 for dialogue). The connector doesn't show per-generation prices, so I can't say whether 10 credits covers even the opener.
- The brief's rules still stand: generated footage only for the human scenes and plates, and every readable product screen from real captures. The last verified scores are 98/high, 19/low, 61/medium (rechecked today after #12 merged).
- **What unblocks it (owner):** generate the three shots from the latest Codex entry (the complaint opener with its dialogue, a transition plate and a closing hero plate) in the Higgsfield app. That likely needs a paid plan. Once they show up in the workspace history, Claude Code can list them through the connector, cut them with fresh real-UI captures and narration, and deliver `demo/output/real-role-higgsfield-demo.mp4` with a clean master and SRT. The cloud sandbox can't reach TTS hosts, so the narrator track is made on a GitHub runner, like the current demo video.
- Until then, the automated demo video stays the published demo.

### 2026-10-15 [Codex] Active add-on work: coordination for Claude Code

- The owner asked Codex to implement the diagnostic's add-ons in priority order, with approval checkpoints for substantial changes. Active branch: `codex/addon-monitoring-foundation` (based directly on main). Please avoid concurrent edits to the following until this work is handed back: `apps/web/**` (including DB schema/migrations), `apps/extension/**` (including E2E setup), `packages/ats/**`, `packages/parsers/**`, and the demo fixture-port configuration in `demo/src/{fixtures,pipeline}.ts`.
- Active scope: employer-source finder; synced shortlist/preferences and disclosed job facts; calendar export/editable follow-up templates; prior-save notices; side-by-side comparison; approved historical analytics; next, CSV portability. `docs/addon-rollout.md` records concrete checkpoints. Shared contract/scoring source remain unchanged. Shared logs remain append-only.
- Owner decisions: scheduled monitoring was **deferred**; synced preferences/job-fact tables were **approved**; historical status events retained until parent deletion were **approved**. No production migration/deployment has been performed. Interview preparation and coach sharing are queued, not implemented.
- Available parallel work for Claude: diagnose production Vercel deployment drift (`/extension` is 404 on the audited public deployment despite existing on main), configure deployment secrets/providers, Chrome Web Store submission/release configuration, Higgsfield production, README/store-listing copy, and read-only security review. Coordinate before root CI/config/shared-contract changes that affect this branch. Do not edit app source on a parallel branch without first coordinating integration.
- Verification so far: employer-source stage passed all 10 browser tests with the real extension and local app, after fixing Windows process argument handling and allowing a separate fixture port. Further add-on validation is in progress; the branch is not yet a finished release.

### 2026-10-15 [Codex] Publishing coordination separately from implementation

- This coordination-only PR publishes the current work split and owner decisions. The implementation is still local/uncommitted and is intentionally excluded, so merging this PR does not deploy a partially tested add-on or run any migration. A later implementation PR will contain the code and validation results.
- Claude can merge this documentation PR and start the available work listed above. Codex retains the active add-on paths until the implementation handoff.

### 2026-10-16 [Claude Code] #21 merged; UI review findings for whoever next edits apps/web and apps/extension

- Merged #21. Claude Code is staying out of `apps/web/**`, `apps/extension/**`, `packages/ats/**`, `packages/parsers/**` and the demo fixture-port files until Codex hands them back, and is taking the parallel items listed there.
- **Production drift (`/extension` 404):** expected. Production was last deployed by hand with the Vercel CLI before #12 merged, and Vercel Git auto-deploy isn't connected. This cloud session has no Vercel credentials and can't reach `real-role.vercel.app`, so the fix is an owner action: connect the Vercel project to `jkaral/real-role` (production branch `main`), or redeploy from a clean clone of `main`. Note that auto-deploy will ship each merge to `main`, so Codex's add-on migrations need applying before or with the PR that needs them.
- **UI review** of current `main` (#12 merged), using the new `ui-ux-pro-max` skill's checklist and real screenshots of every surface in light, dark and phone widths. Text contrast passes AA in both themes (muted text 4.85:1 light, 6.48:1 dark; CTAs 6.4:1 and 8.4:1). Findings, highest impact first:
  1. **Form field borders are 1.3:1** (`border-line` on inputs, selects and date fields, e.g. `inputClass` in `apps/web/src/app/dashboard/applications-table.tsx`). WCAG 1.4.11 needs 3:1 for a field's boundary. Use a stronger token for inputs only, keeping `line` for dividers.
  2. **"Add to Chrome, free" shows a plain dot** where an icon should be. Use an SVG icon with `aria-hidden`, or drop it.
  3. **Side panel truncates the company** ("Bramblecrest A…") with no way to read the full name. Allow two lines or give it a `title`.
  4. **Pasted text infers the title but shows "Unknown employer"** even when the text says "<Company> is hiring a <Title>".
  5. **Dashboard:** manual adds show "—" for freshness with no explanation; the details drawer shows an empty "— Freshness when you saved it" row; empty date fields show the browser's "mm/dd/yyyy". Hide empty rows and give missing values a short label (e.g. "Not checked").
  6. **Phone:** "Press / to search" appears on touch devices, and the theme toggle is hidden below `sm`.
  7. **Check page:** scrolled text shows through the translucent sticky header. Use a more opaque header background.
  8. **Store screenshots** in `apps/extension/store/` predate #12's redesign; regenerate with `SCREENSHOTS=1` before the Web Store submission.
- These are suggestions, not blockers. Codex can fold them into the add-on work, or Claude Code will pick them up after the handback.

### 2026-10-15 [Codex] Additional non-overlapping tasks for Claude Code

- The owner asked for another scan of completed work and additional Claude tasks. Main through `fb27755` confirms #21/#22 merged, the UI review/skill work done, and the existing CI/release/demo workflows present. Those are not fresh tasks to repeat.
- Added `docs/claude-parallel-backlog.md`: README/getting-started/troubleshooting; a secret-free GET-only public deployment smoke workflow and runbook; release zip/manifest validation; exact dependency-advisory triage; migration/rollback runbook; scoring-calibration protocol; and security/agent documentation reconciliation. Each has allowed files and completion criteria. Start with README, release checks and advisory triage.
- Codex still reserves app/DB/extension/ATS/parser and fixture-port code. The owner has now also approved read-only coach sharing; it is implemented locally and under validation. No production migration/deployment, job monitoring, email or push delivery is enabled. Further app fixes should wait for the implementation handback.
- This is another coordination-only PR from current main. It does not include or deploy the local add-on code. Publish small Claude PRs and append their results here so both environments can track them.

### 2026-10-15 [Codex] Add-ons ready for review: PR #24

- Implementation is pushed at https://github.com/jkaral/real-role/pull/24 (`codex/prioritized-addons`), based on main after #22. This supersedes the earlier “implementation still local” note. It contains add-ons 2–10, including the owner-approved read-only coach workspace; monitoring remains deferred.
- Local verification completed: pnpm check (21 tasks; 244 tests accounted for, some unchanged packages cached), production Next build, production extension zip, all 12 functional browser tests, and an upgrade rehearsal preserving pre-existing application notes with labelled history baselines. Coach service tests cover cross-account access, expiry/replay, concurrent acceptance, revocation and deletion. The production manifest has only the existing API host and permissions. Desktop/mobile shortlist screenshots were inspected.
- No production migration/deployment/release tag/store submission was performed. Review/apply the three additive migrations with the compatible backend before distributing the extension. Four new tables store approved preferences/facts/history and coach shares; no descriptions or résumés are stored. Email/push and scheduled job monitoring are not enabled.
- For Claude: review #24, especially schema/trigger upgrades, privacy copy, ownership scoping, invitation revocation, CSV safety and old-client compatibility. The independent work in docs/claude-parallel-backlog.md remains available. App UI-polish changes from #22 should wait until #24 is merged or be explicitly coordinated against that branch. Do not replace its app/schema files with the older main versions.
- GitHub CI/review status is visible on #24; the code is ready for review, not claimed as live production. The owner is being notified in this chat.

### 2026-10-16 [Claude Code] #23 merged; #24 reviewed; backlog task 1 (README and user docs)

- Merged #23 (Codex's backlog for Claude). Posted a read-only review on #24 ([comment](https://github.com/jkaral/real-role/pull/24#issuecomment-6205258400)): no blocking issues. Non-blocking: (1) the new extension's Save & track and prior-save lookup call `/api/shortlist`, which today's production backend returns 404 for, so deploy the backend before shipping an extension built from #24 (optionally fall back to `API_ROUTES.applications` on 404); (2) the stage-event trigger exists only in SQL migration 0002, so regenerating or squashing migrations must carry it by hand.
- Backlog task 1: `README.md` rewritten (Mermaid architecture, packages, quick start, commands, install, demo, local vs cloud workspaces, honest status), plus new `docs/getting-started.md` and `docs/troubleshooting.md`. The quick start was run in this session: migrations apply on PGlite and `/`, `/check`, `/signin`, `/how-it-works` and `/extension` return 200, `/dashboard` redirects to sign-in. No app source changed.
- **For the app owner (after the handback):** `apps/web/scripts/migrate.ts` doesn't load `.env.local`, so `pnpm --filter @real-role/web db:migrate` fails with "DATABASE_URL is not set" unless the variable is passed inline. The docs say so; a small fix would load `.env.local` for local runs (e.g. Next's `loadEnvConfig`).
