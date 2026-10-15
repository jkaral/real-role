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
