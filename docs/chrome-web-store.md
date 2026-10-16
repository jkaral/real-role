# Chrome Web Store listing

Everything needed to submit the Real Role extension. Submission itself is an owner action (developer account, one-time $5 fee).

## Build the package

```bash
pnpm install
pnpm --filter @real-role/extension zip
```

Upload `apps/extension/.output/real-role-extension-<version>-chrome.zip`. It's built against the production API (`https://real-role.vercel.app`). Bump `version` in `apps/extension/package.json` for every new upload.

## Release checks

Before uploading, or before a GitHub release, verify the zip:

```bash
node scripts/verify-extension-release.mjs --tag v<version> --check-backend --checksum-out SHA256SUMS
```

It fails unless **all** of these hold:

- Exactly one `real-role-extension-*-chrome.zip` in `apps/extension/.output`.
- `manifest_version` is 3, the manifest version matches `apps/extension/package.json`, and the tag is `v<version>` or `v<version>-<suffix>` (a suffix publishes a pre-release).
- `host_permissions` is only `https://real-role.vercel.app/*`. Permissions are exactly `sidePanel`, `storage`, `activeTab`, `scripting`, with no optional permissions and no `web_accessible_resources`. `externally_connectable` is `{ "ids": [] }`.
- The extension-page CSP has `script-src 'self'`, `object-src 'none'` and `connect-src https://real-role.vercel.app`.
- Content scripts match only `https://` job-board patterns, and every referenced file exists: all four icons, the side panel page, the service worker and the content scripts.
- No file contains `localhost`, `127.0.0.1`, `.example` hostnames or fictional fixture companies. Those mean a demo or e2e build (`build:demo`) was packaged by mistake.
- **Backend compatibility (`--check-backend`):** every `/api/...` path the bundle calls answers on production with something other than 404. Sign-in errors (401) and wrong-method errors (405) are fine. A 404 means the extension is newer than the deployed backend, so deploy the web app first.

The **Release** workflow runs these checks on every `v*` tag (`node --test scripts/*.test.mjs` first, then the verifier) and attaches `SHA256SUMS` next to the zip. The verifier's tests also run in CI on every PR.

## Install, update and compatibility

- **Install (before the store listing):** download the zip from the GitHub release, unzip it into a folder you'll keep, then on `chrome://extensions` turn on Developer mode and click **Load unpacked**. Check the download with `sha256sum` against `SHA256SUMS`.
- **Update:** unzip the new release over the same folder and click the reload icon on the extension's card. Store installs update automatically.
- **Compatibility:** deploy the backend before the extension. An older installed extension keeps working against a newer backend, because existing routes and the shared contract stay compatible. A newer extension against an older backend can fail where it calls new routes, which is what `--check-backend` catches.

## Store listing

| Field                | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Name                 | Real Role: job posting freshness                                                                 |
| Summary (≤132 chars) | See how likely a job posting is to be a real, active opening, with the signals behind the score. |
| Category             | Workflow & Planning                                                                              |
| Language             | English                                                                                          |
| Homepage             | https://real-role.vercel.app                                                                     |
| Support              | https://github.com/jkaral/real-role/issues                                                       |
| Privacy policy       | https://real-role.vercel.app/privacy                                                             |

### Description

> Job hunting takes long enough without applying to postings that stopped hiring months ago.
>
> Real Role gives the job posting you're viewing a Freshness Score from 0 to 100: an estimate of how likely it is to be a real, active opening. Open the side panel to see exactly why:
>
> • Posting age: when the role was posted.
> • Repost history: how long Real Role users have been seeing the same role.
> • Careers page: whether the role is listed on the employer's own job board (Greenhouse, Lever, Ashby).
> • Description detail: whether it names a pay range, a team, and concrete duties.
> • Company hiring activity: how recently the employer's open roles changed.
>
> Every point in the score comes from a signal you can see, and missing information lowers the confidence instead of the score. Real Role shows signals, not verdicts.
>
> Save postings you apply to with "Save & track" and follow up from your Real Role dashboard.
>
> Privacy: Real Role reads only the page you're on, and only on job posting pages or when you click its icon. It never reads your browsing history.

### Images

| Asset                                     | File                                             |
| ----------------------------------------- | ------------------------------------------------ |
| Icon 128×128                              | `apps/extension/public/icon/128.png`             |
| Small promo tile 440×280                  | `apps/extension/store/promo-440x280.png`         |
| Screenshot 1 (1280×800): high freshness   | `apps/extension/store/screenshot-1-fresh.png`    |
| Screenshot 2 (1280×800): low freshness    | `apps/extension/store/screenshot-2-reposted.png` |
| Screenshot 3 (1280×800): medium freshness | `apps/extension/store/screenshot-3-vague.png`    |

Screenshots use the fictional demo postings and are regenerated from the real extension with `SCREENSHOTS=1 pnpm --filter @real-role/extension e2e`. Icons and the promo tile: `node scripts/make-icons.mjs` in `apps/extension`.

## Privacy practices tab

### Single purpose

> Show a freshness score, with its supporting signals, for the job posting the user is viewing, and let the user save postings to track their applications.

### Permission justifications

| Permission                                                                                                 | Justification                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                                                                                                | Shows the score breakdown and the "Save & track" button in Chrome's side panel.                                                        |
| `storage`                                                                                                  | Keeps the current tab's score in session storage so the side panel can display it. Cleared when the browser closes.                    |
| `activeTab`                                                                                                | When the user clicks the toolbar icon on a site that isn't a known job board, lets Real Role read that one page to find a job posting. |
| `scripting`                                                                                                | Runs Real Role's posting reader on the current tab after the user clicks the toolbar icon (paired with `activeTab`).                   |
| Host permission `https://real-role.vercel.app/*`                                                           | Sends the extracted posting fields to Real Role's API for scoring and saves tracked applications to the user's account.                |
| Content script on job boards (Greenhouse, Lever, Ashby, Workday, Wellfound, Indeed and LinkedIn job pages) | Reads the job posting on the page the user is viewing so the score badge appears automatically. Runs on these job-board URLs only.     |

### Remote code

> No, I am not using remote code. All JavaScript ships in the package.

### Data usage

What the extension sends to Real Role's server, and only from job posting pages the user is viewing:

| Data type (Chrome form)                                 | Collected? | Notes                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website content                                         | **Yes**    | Posting title, company, location, posted date, salary, description text and the posting's URL. Used only to compute the score. The description isn't stored; it may be sent to Anthropic's Claude API to rate specificity. Sightings are stored anonymously (role, URL, day), with no user id. |
| Authentication information                              | No         | The extension doesn't collect credentials. It uses the user's existing Real Role session cookie when saving.                                                                                                                                                                                   |
| Personally identifiable information                     | No         |                                                                                                                                                                                                                                                                                                |
| Health / financial / personal communications / location | No         |                                                                                                                                                                                                                                                                                                |
| Web history                                             | No         | Only job posting pages, and only their posting fields. No list of visited pages is collected.                                                                                                                                                                                                  |
| User activity                                           | No         |                                                                                                                                                                                                                                                                                                |

Certify all three:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Submission checklist (owner)

1. Create or sign in to a Chrome Web Store developer account (one-time $5 fee) at https://chrome.google.com/webstore/devconsole.
2. **New item** → upload the zip.
3. Fill in **Store listing** from the tables above and upload the images.
4. Fill in **Privacy practices** from the section above.
5. **Distribution:** Public (or Unlisted for a soft launch), all regions.
6. Submit for review. After approval, send me the extension ID: it goes into `EXTENSION_ORIGINS` on Vercel (`chrome-extension://<id>`) and into the README.

## Security checklist (Chrome Web Store best practices)

Checked against https://developer.chrome.com/docs/webstore/best-practices and the linked "Stay secure" guide on 2026-10-15.

| Practice                                                                  | Status                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Manifest V3                                                               | Yes                                                                                                  |
| User data sent only over HTTPS                                            | Yes: the production build talks only to `https://real-role.vercel.app`                               |
| Minimal permissions and narrow host patterns                              | Yes: 4 permissions, the API host only, job-board content-script patterns; no `<all_urls>`, no `tabs` |
| Explicit CSP for extension pages                                          | Yes: `script-src 'self'`, `object-src 'none'`, `connect-src` = API only                              |
| `externally_connectable` restricted                                       | Yes: `{ "ids": [] }` (no websites or other extensions)                                               |
| Minimal `web_accessible_resources`                                        | Yes: none                                                                                            |
| No `innerHTML` / `document.write` / `eval` / remote code                  | Yes                                                                                                  |
| Content-script messages validated; privileged calls in the service worker | Yes: `src/lib/messages.ts`, tested                                                                   |
| No `unload` handlers; bfcache-friendly; no WebSockets in content scripts  | Yes                                                                                                  |
| End-to-end tests                                                          | Yes: `apps/extension/e2e` (runs in CI)                                                               |
| Privacy tab matches the privacy policy                                    | Yes: see "Privacy practices" above and https://real-role.vercel.app/privacy                          |
| Listing images: icon, small tile, screenshots                             | Yes. A marquee (1400×560) is optional and only used if the item is featured                          |

**Owner actions for the developer account:**

- Turn on **2-step verification, preferably with a security key**, on the Google account that owns the Chrome Web Store developer account.
- If you add other publishers to the account, give each the least role they need.
- Optionally add a promo video to the listing (Codex's demo video, once it's recorded).
