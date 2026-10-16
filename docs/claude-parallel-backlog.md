# Claude Code: parallel backlog while Codex finishes add-ons

Requested by the owner on 2026-10-15 after reviewing main through `fb27755` (#22). Work on a `claude/*` branch from current main. Do not change Codex's active app, DB/migration, extension, ATS, parser or demo fixture-port files. Each task below can be developed independently of those files.

## Already done — do not repeat

- #21 merged: active work split and add-on approval checkpoints are on GitHub.
- #22 merged: ui-ux-pro-max skill installed, UI review completed, production deployment drift explained.
- Linux check/E2E CI, optional demo recording and a tag-triggered extension release workflow already exist.
- Higgsfield generation and production Vercel configuration are blocked on owner accounts/credentials. Do not spend another turn rediscovering those blockers.

Codex's current local implementation includes employer-source lookup, synced preferences/job facts, calendar/templates, prior-save notices, comparison, historical analytics, CSV portability, local interview preparation and approved read-only coach sharing. The owner approved preference/fact tables, status history retention and the coach authorization model. Monitoring remains deferred. Do not implement a parallel version of these features. The implementation PR is forthcoming; currently published coordination docs are not proof that these features are deployed.

## 1. Finish the README and supporting user documentation

**Files:** `README.md`, new `docs/getting-started.md`, new `docs/troubleshooting.md`.

Replace the placeholder README with a Mermaid architecture diagram, accurate development/production setup, sign-in configuration names (placeholders only), test/build commands, website and installation links, and an honest demo link. Explain local versus cloud workspaces and backend-first extension deployment. Include common failures: unsupported page/structured data, login-required pages, unknown evidence, sign-in provider not configured, API unavailable and rate limits.

**Done when:** commands match existing package scripts; links resolve or are explicitly pending; no claim that unpublished add-ons are live; no secrets or fictional demo scores presented as real customer outcomes. No app-source edits are needed.

## 2. Add a credential-free public deployment smoke workflow

**Files:** new `.github/workflows/deployment-smoke.yml`, new root `scripts/deployment-smoke.mjs`, new `docs/deployment-runbook.md`.

Use manual dispatch initially. GET only the production landing/check/extension/sign-in/privacy/how-it-works routes; verify expected status, HTML and redirect behavior without signing in, scoring a posting or writing data. Bound timeouts/retries and fail on missing routes. Restrict the destination to the configured production origin rather than accepting arbitrary URLs. Record that current production may fail `/extension` until the owner redeploys. Once the implementation PR is available, add expectations for `/shortlist`, `/insights` and `/coach` with their intended authentication behavior.

Write the owner runbook for connecting the correct Vercel project to this repository and checking its production branch/root, migrations and public routes. Use current official provider docs rather than guessing CLI flags. Do not deploy or change secrets from this cloud session.

**Done when:** the script can demonstrate a useful failure against a fixture or local stub; the workflow needs no private secret; it never masks the known old deployment as success. Do not enable automatic production deployment without the owner's review of the concrete setup.

## 3. Harden the existing release workflow's artifact checks

**Files:** `.github/workflows/release.yml`, new root `scripts/verify-extension-release.mjs`, `docs/chrome-web-store.md`.

Validate the built zip/manifest before publication: correct tag/version, production API origin, no localhost/demo host permissions or fixture content matches, expected MV3 permissions/CSP, required icons/panel files, and a single unambiguous zip. Add a checksum artifact and document installation/update/backend compatibility. Keep the existing release trigger; do not create/push a release tag or publish a Web Store submission during this task.

**Done when:** the verifier rejects a deliberately demo-configured manifest and accepts the production build. Coordinate any version bump or package/lockfile change with Codex; do not edit `apps/extension/**` while it is reserved.

## 4. Triage the currently reported dependency advisory

**Files:** new `docs/dependency-triage.md`; root dependency/CI changes only after coordination if needed.

GitHub currently reports one moderate advisory on the default branch. Inspect its exact advisory, installed dependency path, production versus build/test exposure, and fixed-version options using `pnpm audit --prod` and the official advisory. Do not repeat the stale assertion in SECURITY.md that the audit is clean without a fresh check. Propose the smallest compatible fix, with a reproduction/validation plan. Do not upgrade unrelated packages or silently regenerate Codex's active lockfile.

**Done when:** the report distinguishes confirmed affected code from hypothetical exposure and names the exact proposed upgrade. If a fix needs an app-owned dependency or major upgrade, wait for the handback/owner checkpoint; documentation and evidence can be completed now.

## 5. Prepare migration and rollback operations documentation

**Files:** new `docs/database-operations.md`, root manual CI workflow if useful.

Using the forthcoming implementation migration files read-only, document additive migration order, backup/restore prerequisites, isolated preview database checks, handling of older application records, and safe feature rollback. Do not assume that reverting application code reverses DB migrations or deletes shared/history data. Include a production verification checklist that checks table/constraint existence and ownership/cascade behavior without dumping personal records. A disposable database rehearsal is permitted; production migration/restore is not.

**Done when:** another maintainer can rehearse both a fresh schema and upgrade from the pre-add-on schema; the runbook names what is reversible and what data would be lost by a restore. Coordinate root CI changes; do not edit Codex's migration or DB-test files.

## 6. Add a scoring calibration/evaluation plan

**Files:** new `docs/scoring-validation.md`; optional new Claude-owned scoring evaluation tests outside `test/edge/**`.

Define what the score does and does not predict. Separate employer listing presence, stale advertisement dates, repeat observations and actual hiring outcomes. Specify a consented/permitted evaluation corpus, board-wise coverage, match precision, false-absence rate, unknown-evidence rate, and probability calibration criteria if probabilities are ever advertised. Start with fictional examples and mocked I/O; no crawling and no collection of real applicant histories.

**Done when:** metrics, label definitions and sample-size limitations are explicit; there is a repeatable evaluation protocol. Do not retune scoring weights or change existing public types without evidence and coordination. Codex is not changing the freshness engine in this add-on PR.

## 7. Reconcile security/agent documentation with implemented behavior

**Files:** `SECURITY.md`, `CLAUDE.md` and identical `AGENTS.md`, `.github/security-review/**` if necessary.

After reading the actual auth and approved add-on design, correct outdated statements: magic-link sign-in deliberately stores its email address; optional coach sharing is an explicitly consented, account-bound exception to default owner-only reads; user preferences/facts/history have documented deletion rules. Preserve anonymous sightings, no description/résumé storage, no board crawling, no logged-in automation, no new extension permissions and validation at boundaries. Add a review checklist for single-use invitation binding, revocation, private-note exclusion, CSV formula escaping and cascade deletion. Do not loosen policies to authorize features the owner deferred.

**Done when:** documentation is internally consistent, agent files remain byte-identical, and policy changes describe only existing/approved behavior. Do not edit application source as part of this task.

## Coordination and delivery

- Begin with tasks 1, 3 and 4; task 2 can be built without credentials; task 5 uses the implementation PR once pushed. Tasks 6 and 7 are independent documentation/review work.
- Use small PRs from main. Append results and exact PR links to HANDOFF.md. Never silently resolve a conflict by replacing Codex's app or schema code.
- Keep UI review fixes, new parser coverage, scoring-path caching/timeouts and rate-limit retention implementation queued for the app handback. They would overlap the active code and should not be started in parallel.
- Web Store screenshot regeneration and final demo recapture should use the merged final app, not an older UI. Prepare copy/checklists now; generate final assets after the add-on merge.
