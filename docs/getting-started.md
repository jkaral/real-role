# Getting started

How to run Real Role locally, configure sign-in, load the extension, and ship to production. For the short version see the [README](../README.md); for problems see [troubleshooting](troubleshooting.md).

## 1. Prerequisites

- **Node 22** (the version in `.nvmrc`) and **pnpm 10**: `corepack enable`, or `npm i -g pnpm`.
- **Chrome or Chromium** to try the extension.
- Optional: a [Neon](https://neon.tech) Postgres database. Locally you can use PGlite, an in-process Postgres, instead.

```bash
pnpm install
pnpm check      # format, agent-docs check, lint, typecheck, unit tests
```

## 2. Run the web app locally

```bash
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local`. The minimum for local work:

| Variable       | Local value                                                     |
| -------------- | --------------------------------------------------------------- |
| `DATABASE_URL` | `pglite:./.pglite-dev` (a folder under `apps/web`, git-ignored) |
| `AUTH_SECRET`  | output of `npx auth secret`                                     |

Then:

```bash
# db:migrate doesn't load .env.local, so pass the database URL inline
DATABASE_URL=pglite:./.pglite-dev pnpm --filter @real-role/web db:migrate
pnpm --filter @real-role/web dev
```

Open http://localhost:3000. Checking a posting works without an account. The dashboard needs sign-in, so configure at least one provider (next section). Without any, the sign-in page says "Sign-in isn't set up on this server yet."

### Optional: the AI rubric

Set `ANTHROPIC_API_KEY` to add a Claude rubric to the **Description detail** signal (model: `RUBRIC_MODEL`, default `claude-haiku-5-5`). Without a key, the score uses the built-in heuristics only. Results are cached by posting fingerprint.

## 3. Sign-in providers

Each method appears on the sign-in page only when all of its variables are set. Use placeholders in `.env.example`; real values go in `apps/web/.env.local` locally and in Vercel's project settings for production. Never commit them.

| Method     | Variables                              | Callback / notes                                                                   |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| GitHub     | `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth app; callback `<site>/api/auth/callback/github`                       |
| Google     | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth client; callback `<site>/api/auth/callback/google`                    |
| Email link | `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`   | Resend API key and a verified sending domain, e.g. `Real Role <signin@yourdomain>` |

`<site>` is `http://localhost:3000` locally and `https://real-role.vercel.app` in production. Email sign-in deliberately stores the email address, and the privacy page says so; GitHub and Google keep a display name only.

## 4. Load the extension

**Against your local web app**, use the demo build. It talks to `http://localhost:3100` and also runs on `http://127.0.0.1` fixture pages:

```bash
pnpm --filter @real-role/extension build:demo
```

The demo build expects the API on port **3100**, so run the web app there: `pnpm --filter @real-role/web dev --port 3100`.

**Against production**, build normally (`pnpm --filter @real-role/extension build`) or download the release zip.

Either way: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `apps/extension/.output/chrome-mv3` (or the unzipped release folder). Open a job posting on Greenhouse, Lever, Ashby, Workday, Wellfound, Indeed or LinkedIn and the badge appears. On other sites, click the Real Role toolbar icon.

Saving from the extension uses your Real Role session cookie, so sign in on the matching site first. The extension's host permission lets it call the API directly; no CORS setup is needed.

## 5. Tests

| Command                                  | What it covers                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                             | Format, agent docs, lint, typecheck and all unit tests                                                                                        |
| `pnpm --filter @real-role/<pkg> test`    | One package's unit tests                                                                                                                      |
| `pnpm --filter @real-role/extension e2e` | Builds the demo extension and runs Playwright against a local web app on PGlite with fictional fixture pages. Needs ports 3100 and 4173 free. |
| `pnpm demo:video`                        | The recorded demo run (also a test); needs ffmpeg and a TTS option, see `demo/README.md`                                                      |

If your Chromium differs from the one Playwright pins, point the e2e run at it with `PW_CHROMIUM_PATH=/path/to/chrome`.

## Production

Production is the Vercel project serving https://real-role.vercel.app, with a Neon Postgres database.

**Environment variables (Vercel → Project → Settings → Environment Variables):** `DATABASE_URL` (Neon, pooled), optionally `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, the provider variables you use, `SITE_URL`, optional `EXTENSION_ORIGINS` (`chrome-extension://<id>`, comma-separated; adds CORS headers for those extension ids, which the extension doesn't strictly need because of its host permission), optional `ANTHROPIC_API_KEY`, and `EXTENSION_STORE_URL` once the Web Store listing exists. Never set `ALLOW_DEMO_SEED` in production.

**Build command:** `pnpm --filter @real-role/web build:vercel`. It runs migrations only when `VERCEL_ENV=production`, then `next build`. Preview builds never touch the production database. Migrations are additive and are not undone by redeploying older code; see `docs/database-operations.md` (planned) before rolling back.

**Deploy order: backend first, then the extension.** A new extension build can call API routes that only the new backend has. Ship in this order:

1. Merge to `main` and deploy the web app (migrations run during the production build).
2. Check the new routes respond on production (a GET without sign-in should return a sign-in error, not 404).
3. Then build and publish the extension: push a `v*` tag matching `apps/extension/package.json`'s version, and the **Release** workflow attaches the zip to a GitHub release.

An already-installed older extension keeps working against the newer backend, because existing routes and the shared contract stay compatible.

## Where to go next

- How the score is computed: [`docs/scoring.md`](scoring.md)
- Chrome Web Store submission: [`docs/chrome-web-store.md`](chrome-web-store.md)
- Security model: [`SECURITY.md`](../SECURITY.md)
- Agent workflow and ownership: [`CLAUDE.md`](../CLAUDE.md)
