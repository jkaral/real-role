# Deployment runbook

How production is deployed, how to connect Vercel to this repository so `main` deploys automatically, and how to check a deployment without signing in. All Vercel steps are **owner actions**: the agents have no Vercel credentials, and Claude Code's cloud sessions can't reach the production site.

Vercel's dashboard changes over time. The paths below come from Vercel's documentation as of 2026-10-16 ([monorepos](https://vercel.com/docs/monorepos), [production branch](https://vercel.com/kb/guide/can-i-use-a-non-default-branch-for-production), [`vercel git`](https://vercel.com/docs/cli/git)). If a menu has moved, follow the current docs.

## How production works today

- **Site:** https://real-role.vercel.app, a Vercel project serving `apps/web` (Next.js), backed by Neon Postgres.
- **Deploys:** so far by hand from the Vercel CLI. Merging to `main` does **not** deploy anything, so production lags `main` until someone redeploys. As of 2026-10-16, `/extension` (merged in #12) returns 404 on production for this reason.
- **Migrations:** the build command `build:vercel` (in `apps/web/package.json`) runs `scripts/migrate.ts --production-only`, then `next build`. Migrations run only when `VERCEL_ENV=production`, so preview deployments never touch the production database.

## Connect the Vercel project to GitHub (one-time, owner)

1. **Open the existing project** that serves `real-role.vercel.app`. Don't create a second project; the domain and environment variables live on the existing one.
2. **Connect the repository.** In the project's settings, connect the Git repository `jkaral/real-role`. Vercel asks you to install its GitHub app if needed. (CLI alternative: `vercel link` in a clone, then `vercel git connect`.)
3. **Production branch.** Set it to `main`: **Settings → Environments → Production → Branch Tracking** (older dashboards: **Settings → Git → Production Branch**). Every push to `main` then creates a production deployment. Pushes to other branches and PRs get preview deployments.
4. **Build settings** (**Settings → Build and Deployment**). Check these match:
   - **Root Directory:** `apps/web`
   - **Build Command:** `pnpm build:vercel` (runs from `apps/web`)
   - **Install Command:** default (pnpm, detected from `pnpm-lock.yaml`)
   - Workspace packages outside the root directory (`packages/*`) must be included. Vercel includes them for monorepos by default; leave that on.
   - **Node.js version:** 22 (matches `.nvmrc`)
5. **Environment variables.** Check that production has the variables listed in [getting started](getting-started.md#production). `ALLOW_DEMO_SEED` must **not** be set. Preview deployments need their own `DATABASE_URL` (a Neon branch), never the production database.
6. **First deployment.** Redeploy `main` from the dashboard, or push a commit, and wait for it to finish.
7. **Smoke test.** Actions → **Deployment smoke** → **Run workflow** (see below). It must pass, including `/extension`.

**Before turning this on,** note that once auto-deploy is on, every merge to `main` ships to production, and its migrations run during the build. A PR that adds migrations, like #24, deploys them the moment it merges. See the next section.

## Deploying changes with migrations

Migrations are additive (new tables and columns, no drops) and run automatically in the production build. Redeploying older code does **not** undo them.

1. Before merging, confirm the PR's migrations apply cleanly to a copy of production. Use a Neon branch of the production database as the preview's `DATABASE_URL`, or run `db:migrate` against a disposable database.
2. Merge, and let the production deployment run the migrations.
3. Run the smoke test. For #24, use **with add-on routes**.
4. Only then publish an extension that depends on the new routes (backend first). The release workflow enforces this with `--check-backend`; see [`chrome-web-store.md`](chrome-web-store.md#release-checks).

Rollback and restore steps, including which data a restore would lose, are covered in [database operations](database-operations.md).

## Smoke test

`scripts/deployment-smoke.mjs` sends GET requests to fixed public routes on https://real-role.vercel.app. It doesn't follow redirects; it checks the status and, for redirects, the target.

| Route                                             | Expected                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `/`                                               | 200 HTML containing "Real Role"                                      |
| `/check`                                          | 200 HTML                                                             |
| `/how-it-works`                                   | 200 HTML containing "Freshness Score"                                |
| `/privacy`                                        | 200 HTML                                                             |
| `/signin`                                         | 200 HTML                                                             |
| `/extension`                                      | 200 HTML (**fails on the current deployment** until it's redeployed) |
| `/dashboard`                                      | redirect to `/signin…` (signed out)                                  |
| `/api/applications`                               | 401 (needs sign-in)                                                  |
| **With add-ons (#24):** `/shortlist`, `/insights` | redirect to `/signin?callbackUrl=…`                                  |
| `/coach`                                          | 200 HTML "Coach workspace" (signed-out prompt)                       |
| `/api/shortlist`                                  | 401                                                                  |

- **From GitHub:** Actions → **Deployment smoke** → **Run workflow**. Tick **with_addons** only after #24 is deployed. No secrets are needed.
- **Locally:** `node scripts/deployment-smoke.mjs [--with-addons]`.
- **Against a local build:** `node scripts/deployment-smoke.mjs --origin http://127.0.0.1:3000`. Only the production origin or a loopback address is accepted; the script never fetches other URLs.

It never signs in, scores a posting or writes data. It retries network errors and 5xx responses up to 3 times with a 10-second timeout, and fails on anything else. A 404 on a route that exists on `main` almost always means production hasn't been redeployed.

The workflow is manual for now. After the owner has reviewed the auto-deploy setup above, it can also run after each production deployment, or on a schedule.

## Verified

- On 2026-10-16, a local production build of `main` passed all 8 core checks, and a local build of PR #24 passed all 12 checks with `--with-addons`.
- `node --test scripts/*.test.mjs` includes stub-server tests, including the failure mode of an old deployment that's missing `/extension`.
