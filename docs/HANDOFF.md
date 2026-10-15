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
