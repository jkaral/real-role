# Security

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on https://github.com/jkaral/real-role. Don't open a public issue. We'll acknowledge within a few days and keep you updated until it's fixed.

## How Real Role protects users

### Web app and API (`apps/web`)

- **HTTPS only:** Vercel serves HTTPS, and production responses set HSTS.
- **Security headers:**
  - a Content-Security-Policy (own origin only, no framing, `object-src 'none'`)
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options: DENY`
  - `Cross-Origin-Opener-Policy`
  - `Permissions-Policy`
- **Sign-in:** Auth.js with database sessions, using GitHub, Google or an email link (each enabled only when configured). Cookies are HttpOnly, Secure and SameSite=Lax. Email links are single-use and expire.
- **Cross-site request forgery:** state-changing API requests must come from this site or a browser extension (`assertTrustedOrigin`). This sits on top of the SameSite cookie.
- **Authorization:** every query for tracked applications, preferences, job facts, stage history, imports and exports is scoped to the signed-in user, and another user's id looks exactly like a missing one (404). The one exception is **coach sharing**, below.
- **Coach sharing (opt-in, read-only):**
  - An owner can share one tracked application with one other signed-in account.
  - The invitation secret is 32 random bytes. Only its SHA-256 hash is stored, and the secret travels in the URL fragment (`#invite=`), so it never reaches server logs or `Referer` headers.
  - Pending invitations expire after 7 days, and an application can have at most 5 active shares.
  - An invitation can be accepted once, by one account other than the owner's. This is enforced in the database update itself.
  - The owner can revoke access at any time, and revocation is checked on every read.
  - The recipient sees the title, company, link, status, score at save and disclosed job facts. They never see notes, preferences or other applications, and can't change anything.
- **CSV import/export:** imports are validated, previewed before writing, capped at 50 rows, deduplicated and scoped to the user. Exported cells that start with `=`, `+`, `-` or `@` are escaped against spreadsheet formula injection.
- **Input validation:** every request body is validated with zod against the shared contract.
- **SSRF:** the check page fetches only the single public http(s) page a user submits. Employer-source lookups call only the Greenhouse, Lever and Ashby public APIs: a user-supplied board URL is accepted only on an exact allow-list of hostnames with a strict board-token pattern, and the API URL is built by the server. Private, loopback, link-local and metadata addresses are blocked at connect time, which also defeats DNS rebinding. Redirects are re-checked (at most 3), and fetches are capped at 8 seconds and 2 MB. No cookies are sent, and no scripts run when the page is parsed.
- **AI review:** posting text is untrusted. The model's reply is schema-validated, accusatory wording is dropped, and output is only ever rendered as text.
- **Rate limits:** per-IP limits on every API route.
- **Minimal data:**
  - no description text or résumés stored
  - no avatars stored; an email address is stored only for accounts that sign in by email
  - sightings are anonymous (no user id)
  - per-account data (tracked applications, preferences, disclosed job facts, status history, coach shares) is deleted with its application or account, through cascading foreign keys
- **Local-only tooling:** the demo sign-in and the in-process database (PGlite) refuse to run on Vercel.

### Chrome extension (`apps/extension`)

- **Manifest V3,** with no remote code.
- **Least privilege:**
  - `sidePanel`, `storage`, `activeTab`, `scripting`
  - host permission for the Real Role API only
  - content scripts limited to job-board URL patterns
  - no `<all_urls>` and no `tabs`
- **Explicit CSP for extension pages:** scripts from the package only, network only to the API.
- **`externally_connectable` is empty:** no website or other extension can message it.
- **Untrusted content scripts:** the background worker validates every message's sender, frame and shape. A posting must come from the page that sent it, and only extension pages can ask to check another tab.
- **Safe DOM building:** no `innerHTML` or `eval`. Page data is inserted as text. The badge lives in a shadow root.
- **Session-only state:** per-tab state lives in `storage.session`, in memory only and unreadable by content scripts.

### Repository and CI

- **No direct pushes to `main`:** pull requests and passing CI are required.
- **Least-privilege workflows:** the `GITHUB_TOKEN` is read-only by default.
- **Automated security review:** every same-repo PR is reviewed by [claude-code-security-review](https://github.com/anthropics/claude-code-security-review), pinned to a commit and steered by `.github/security-review/`.
- **Outside contributors:** workflows on their PRs wait for maintainer approval.
- **Dependencies:** `pnpm audit` and `pnpm audit --prod` are clean (checked 2026-10-16). A pnpm override pins a patched esbuild under `drizzle-kit`'s loader; see [`docs/dependency-triage.md`](docs/dependency-triage.md).
- **Release artifacts:** `scripts/verify-extension-release.mjs` checks the extension zip's permissions, CSP and hosts before every release.

## Known limitations

- **Unauthenticated sighting reports:** anyone can report sightings, rate-limited per IP. A determined actor could try to inflate a role's repost history over time. Sightings are anonymous and one per role, URL and day.
- **Inline scripts allowed:** the web CSP allows inline scripts (the Next.js bootstrap, plus a fixed theme script that has no user or page data). Moving to nonces is a planned improvement.
- **Coach sharing can't take back what was seen:** revoking a share stops future reads but can't erase anything the recipient already copied. The privacy page says so.
