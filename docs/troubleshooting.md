# Troubleshooting

Common problems, what causes them, and what to do. Messages are quoted as they appear in the product.

## Using Real Role

### "This page doesn't look like a single job posting."

The extension couldn't find one posting on the page. Common causes:

- **It's a list or search page.** Open the posting itself.
- **The page loads the posting after a delay**, or the site hides details from extensions. Click **Check this page again** in the side panel once the page has finished loading.
- **The site isn't one Real Role recognizes and has no structured data.** Real Role reads Greenhouse, Lever, Ashby, Workday, Wellfound, Indeed and LinkedIn job pages, and on other sites it looks for `JobPosting` structured data (JSON-LD). Without either, use **Paste the posting text instead** and check it on the website.

### The posting needs a login

Real Role reads only what your browser shows you. It never signs in anywhere or automates a logged-in session. If the posting is behind a login, sign in yourself, open the posting, then click the Real Role icon. If the details still aren't readable, paste the text on the check page.

### Checking a link on the website fails

| Message                                                                                                           | Meaning                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "That doesn't look like a valid URL." / "That link isn't a web page."                                             | The link isn't an `http(s)` page. Copy the full address from the browser bar.                                      |
| "We couldn't find that website. Check the link for typos, or paste the posting text instead."                     | The domain doesn't resolve.                                                                                        |
| "We couldn't reach that page. The site may be slow or blocking automated checks; paste the posting text instead." | The site timed out or refused the request. Many job boards block automated fetches; pasting the text always works. |
| "Only public http(s) links can be checked."                                                                       | The link points at a private, local or internal address. Real Role fetches public pages only.                      |
| "That link redirects too many times."                                                                             | More than the allowed number of redirects. Open it in your browser and copy the final address.                     |

### Signals show "Not counted" or "Not checked"

Some evidence isn't available for every posting: the employer may not use Greenhouse, Lever or Ashby, the posting may have no date, or Real Role may not have seen the role before. Missing evidence isn't counted against the posting. The other signals are scaled up and the **confidence** goes down instead. A low-confidence score is a reason to look more closely, not a verdict.

### "Sign in to track applications."

Saving needs an account. Sign in on the website (same browser profile), then click **Save & track** again.

### "Sign-in isn't set up on this server yet."

No sign-in provider is configured on that deployment. Set at least one provider's variables (see [getting started](getting-started.md#3-sign-in-providers)). Each method appears only when all of its variables are set.

### Other sign-in messages

| Message                                                                       | What to do                                                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "That sign-in link has expired or was already used. Ask for a new one below." | Email links are single-use and expire. Request a new one.                                                            |
| "That account is linked to a different sign-in method. Try another one."      | You first signed in with another method (e.g. GitHub). Use that one.                                                 |
| "Sign-in didn't work. Please try again."                                      | Usually an OAuth callback mismatch: check the provider's callback URL matches `<site>/api/auth/callback/<provider>`. |

### "Couldn't reach Real Role. Check your connection." / "Real Role is unavailable right now."

The extension couldn't reach the API, or the API returned a server error. Check your connection and https://real-role.vercel.app. If the site is up but the extension still fails right after an update, the extension may be newer than the deployed backend: the backend must be deployed first (see [getting started](getting-started.md#production)).

### "Too many requests. Try again shortly."

Real Role limits requests per client per minute: 30 score checks, 10 link checks, 60 page observations and 120 application changes. Wait a minute and try again.

## Developing

### `db:migrate` says "DATABASE_URL is not set."

The script reads `apps/web/.env.local` and the shell environment. Check that `.env.local` exists in `apps/web` (not the repo root) and sets `DATABASE_URL`, or pass it inline: `DATABASE_URL=pglite:./.pglite-dev pnpm --filter @real-role/web db:migrate`.

### E2E fails to start, or serves an old build

`pnpm --filter @real-role/extension e2e` needs ports **3100** and **4173** free and refuses to run otherwise, so a stale server can't serve an old build. Stop the other process and rerun. It builds the web app when `.next` is missing; after changing web code, rebuild with `pnpm --filter @real-role/web build`.

### Playwright: "Executable doesn't exist"

Install the pinned browser with `pnpm --filter @real-role/extension exec playwright install chromium`, or point at an existing Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.

### The extension calls the wrong API

`build` targets `https://real-role.vercel.app`, and `build:demo` targets `http://localhost:3100`. Rebuild with the one you need and reload the extension on `chrome://extensions`.

### `pnpm check` fails on agent docs

`CLAUDE.md` and `AGENTS.md` must be byte-identical. Edit `CLAUDE.md`, then copy it to `AGENTS.md`.

### The production site doesn't show a page that exists on `main`

Production is deployed separately from merging. If a route that exists on `main` returns 404 on https://real-role.vercel.app, production hasn't been redeployed since that change. Redeploying is an owner action in Vercel.
