# ATS adapters

Public GET endpoints, checked against official documentation on 2026-10-14:

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html): `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`. Maps `updated_at` to `updatedAt`, never to a publication date.
- [Lever Postings API](https://github.com/lever/postings-api): `https://api.lever.co/v0/postings/{site}?mode=json` (EU: `api.eu.lever.co`). Omitting pagination filters returns the published list. No publication date is inferred.
- [Ashby public Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api): `https://api.ashbyhq.com/posting-api/job-board/{name}`. Maps `publishedAt`; excludes explicitly unlisted roles. Uses the URL identifier when no `id` field is supplied.

`detect` recognizes hosted board/job URLs, then confirms the API shape (including empty boards). An employer domain or custom careers URL alone returns null: these APIs have no domain-to-board directory. Pass a known hosted URL from extracted careers links or an owner-maintained mapping. No employer pages are crawled and no slugs are guessed. Workday is an exported placeholder, outside the launch adapter list.

Requests go only to fixed official API hosts, omit credentials, reject redirects, honor the injected signal, and time out after five seconds. Errors, invalid payloads, 404s and rate limits return null/empty results without retries. The frozen interface cannot distinguish an unavailable board from an empty list; callers should treat failed detection as unknown and must not penalize freshness for missing data.

Matching uses provider-scoped posting IDs, then normalized title token similarity (Dice >= 0.75) and location compatibility (>= 0.4). Missing location lowers match confidence. Callers must supply roles from the correct employer board: the frozen role type contains no company field.

Run `pnpm --filter @real-role/ats test`. Tests intercept HTTP with msw and reject unhandled requests; fixture employers and content are fictional.
