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
