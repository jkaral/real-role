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
- **Sign-in:** Auth.js with GitHub OAuth and database sessions. Cookies are HttpOnly, Secure and SameSite=Lax.
- **Cross-site request forgery:** state-changing API requests must come from this site or a browser extension (`assertTrustedOrigin`). This sits on top of the SameSite cookie.
- **Authorization:** every tracked-application query is scoped to the signed-in user, and another user's id looks exactly like a missing one (404).
- **Input validation:** every request body is validated with zod against the shared contract.
- **SSRF:** the check page fetches only the single public http(s) page a user submits. Private, loopback, link-local and metadata addresses are blocked at connect time, which also defeats DNS rebinding. Redirects are re-checked (at most 3), and fetches are capped at 8 seconds and 2 MB. No cookies are sent, and no scripts run when the page is parsed.
- **AI review:** posting text is untrusted. The model's reply is schema-validated, accusatory wording is dropped, and output is only ever rendered as text.
- **Rate limits:** per-IP limits on every API route.
- **Minimal data:**
  - no description text stored
  - no email addresses or avatars stored
  - sightings are anonymous (no user id)
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
- **Dependencies:** `pnpm audit --prod` is clean as of 2026-10-15.

## Known limitations

- **Unauthenticated sighting reports:** anyone can report sightings, rate-limited per IP. A determined actor could try to inflate a role's repost history over time. Sightings are anonymous and one per role, URL and day.
- **Inline scripts allowed:** the web CSP allows inline scripts (Next.js bootstrap). Moving to nonces is a planned improvement.
