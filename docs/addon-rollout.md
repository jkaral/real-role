# Prioritized add-on rollout

Requested by the owner on 2026-10-15. Implementation proceeds in this order, with review checkpoints for substantial changes. Status below distinguishes working code from planned integrations.

| Order | Add-on                                  | Initial scope                                                               | Status                                                                                         |
| ----- | --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | Saved-job status and change alerts      | Opt-in official-ATS watches, exact listing identifiers, in-app alerts       | Deferred by owner at checkpoint 1; no monitoring scheduled or persisted                        |
| 2     | Employer-source finder                  | Matching official listing link, evidence and user-provided board fallback   | Implemented; source-finder stage passed 10 browser tests; later integration validation pending |
| 3     | Personal application-priority shortlist | Explicit salary/location/experience preferences; separate fit and freshness | Approved by owner; implemented locally; validation in progress                                 |
| 4     | Follow-up assistant                     | ICS/calendar export and editable templates; optional notifications          | Calendar/templates implemented locally; external notifications remain unapproved               |
| 5     | Duplicate/prior-application warnings    | Account-scoped exact match first; similar roles explicitly qualified        | Implemented locally; validation in progress                                                    |
| 6     | Side-by-side job comparison             | Disclosed pay/currency/period, location, requirements and unknowns          | Implemented locally using approved job facts; validation pending                               |
| 7     | Personal search analytics/weekly review | Account-scoped stage history, funnel counts and honest sample sizes         | Approved by owner; implemented locally; validation in progress                                 |
| 8     | Portable tracker                        | CSV export, then previewed/deduplicated import                              | Implemented locally with explicit preview; validation in progress                              |
| 9     | Posting-grounded interview brief        | Questions/checklist grounded in the posting; transient optional background  | Implemented locally without external AI or description storage; validation in progress         |
| 10    | Coach/career-center workspace           | Explicit sharing consent, revocation and separate client access             | Approved by owner; read-only sharing implemented locally; validation in progress               |

The first nine items follow the owner's requested list; the tenth retains the later-stage workspace opportunity in the diagnostic report. Optional fraud checks and mass auto-apply are outside this rollout. No résumé storage, logged-in session automation or bulk job-board crawling is proposed.

## Checkpoint 1: persisted, scheduled watches

### Proposed user experience

1. A signed-in user chooses **Watch this opening** on an exactly identified Greenhouse, Lever or Ashby listing. Saving an application does not automatically enable a watch.
2. The app shows the provider, official board link, listing ID, last successful check and current state. States are **Listed**, **Not found on this board**, and **Could not check**. It never infers that a role was filled or that an employer stopped hiring.
3. Successful later checks can create in-app events for a listing appearing/disappearing or for title/location/department/date/link changes. A first check creates a baseline, not a change alert. An outage preserves the last successful baseline.
4. The user can pause or delete the watch. Signed-out users cannot see or manage any account's watch data. No emails, push notifications or outbound messages in this first release.

### Proposed storage (additive migration; no existing tables dropped)

- `job_watches`: UUID, user/application foreign keys, provider, canonical board URL/token, exact listing ID, enabled flag, next-check time, last-attempt time, last-success time, and minimal last-success snapshot. One watch per user/application. Cascade deletion when that application/account is deleted. A board's polling is shared across opted-in watchers, but subscriptions and events remain private.
- `job_watch_events`: UUID, watch foreign key, idempotency key, event kind, changed field names, observed time and read time. Store only minimal before/after metadata for the watched role; never descriptions, résumés or other users' activity.
- Snapshot metadata is title, location, department, listing URL and provider-supplied posted/updated timestamps. It does not support salary/description-change alerts yet; those must not be advertised.
- Proposed limits: 20 active watches/account; check no more than once per board per 24 hours; bounded worker batches (10 boards/run), one simultaneous request/provider and backoff on errors. Retain events for 90 days, then delete; retain current baseline only while watch exists. These are proposed initial limits, not implemented behavior.

### Proposed execution and protections

- Authenticated application routes use the existing `handle()` wrapper and validate inputs; all reads/writes are scoped to user ID.
- A separately authenticated server worker runs via the deployment's scheduler, never a public unauthenticated trigger. It accepts no user-provided destination URLs. Only canonical provider URLs already validated from a watch are eligible.
- Request coalescing per board, a fixed timeout, retry backoff, bounded batches and idempotent event writes prevent duplicate notifications and uncontrolled API traffic. Claim/lease handling must prevent two workers processing the same batch concurrently.
- Exact listing IDs are required for automated disappearance alerts; fuzzy title matches remain suggestions for a user to confirm. Unsupported boards and malformed/network responses remain unknown. Repeated absence is still labelled “not found,” never “closed.”
- First implement and test against isolated local data with fictional employers and mocked HTTP. Production migrations, scheduler activation and actual provider polling stay off until the checkpoint is approved and release validation passes.
- No new billing service, analytics tracker or email provider. Scheduler/database/API usage can incur additional infrastructure cost; measure it before increasing caps.

### Why owner approval is needed

This changes a request-driven checker into an opt-in background monitoring service. It introduces database tables, persistent per-user watch state and recurring external API traffic. It also extends the privacy disclosure to describe that monitoring. It is a substantial architectural and operational change under the owner's approval rule.

### Rollback

Disable the scheduler and watch feature flag; leave existing checking/tracking functioning. Stop new checks/events immediately. Keep additive tables until any retained watch data has been exported/deleted according to the selected retention policy; do not automatically drop them on rollback. Apply no production migration before approval.

### Independently safe preparation

An additive ATS package function can fetch a validated board once and distinguish successful empty data from lookup failure. Pure comparison logic can evaluate two timestamped exact-listing snapshots without scheduling, persistence, notifications or changes to existing scoring. These additions are internal groundwork, not a completed end-user add-on.

## Later approval checkpoints

- Outbound email/push and any new service account, secret, recurring charge or notification permissions.
- Persistent preference/history fields: review exact schema, privacy disclosure and retention first.
- CSV import: show file validation, row-level conflicts and a concrete import preview before writing; never silently overwrite tracked statuses or notes.
- Interview AI: disclose what transient text leaves the app, define request limits/model and review costs; no background AI calls or résumé storage by default.
- Coach sharing: approve the access-control model, revocation behavior and consent screen before enabling any cross-account data access.
- Changes to the frozen shared contract follow the repository's contract-review process. The owner requested product-wide add-on implementation; app changes are coordinated in HANDOFF.md for Claude review.

## Checkpoint 2: personal shortlist and preference storage

Add-on 1 was deferred by the owner. Add-on 2 is being validated in both surfaces. The next add-on is a preference-based shortlist, with fit shown separately from Freshness Score.

### Proposed full version

- Signed-in users explicitly save preferred job-title keywords, locations, remote preference, employment type, salary minimum/currency/pay period and experience level. Preferences are optional, editable and deletable. No protected-characteristic fields, résumé or employment history are requested.
- Add `job_preferences`, keyed by user ID with cascading account deletion. Add `tracked_job_facts`, keyed by that user's tracked application, for disclosed salary range/currency/period, location/remote/employment type and an explicitly disclosed experience requirement when available. Facts cascade when the tracked application is deleted. Neither table stores description text.
- Preferences and job facts persist across sessions/devices until cleared or their parent is deleted. Disclose this in privacy/settings. Existing saved applications remain valid and show unknown for facts not previously collected; do not silently backfill by fetching unrelated pages.
- Users see a ranked saved-job shortlist with separate freshness, matched preferences, mismatches and missing information. Missing salary or experience is **unknown**, never a rejection. Different currencies or hourly/yearly periods are not compared without explicit conversion; no exchange-rate service is proposed.
- Source facts come from the posting the user checks and chooses to save. Where parsing does not establish an experience requirement, show unknown instead of guessing from the title.
- Keep existing API/score behavior compatible. Any optional shared save-request extension is reviewed through the frozen-contract process. Test ownership isolation, validation, old clients, deletion and preference updates in local PGlite before release.
- No scheduler, outbound messages, paid API or new extension permissions. Additive production migrations remain off until approved and validated.

### Smaller alternative

Browser-only shortlist and preferences: explicitly save minimal job metadata on this browser, let the user clear it, and state that it does not sync across devices or follow account sign-out automatically. No new server tables or shared-contract fields. This is simpler, but it is not a synced account shortlist and must be labelled accordingly.

### Why this checkpoint exists

The full version adds persisted user preferences and job facts that are not currently stored, plus a ranking experience separate from freshness. The owner requested approval for substantial system changes. Approve the synced version, choose the browser-only alternative, or defer this add-on and proceed to calendar/templates.

## Validation required for completion

Each add-on needs a functioning user flow, relevant unit/integration tests, current web/extension builds, neutral copy and an explicit status in the handoff. A plan or unused helper does not count as a shipped feature. Website deployment and the Windows integration-runner defects from the diagnostic remain release dependencies.

## Checkpoint 3: analytics history

The synced shortlist/two-table proposal was approved by the owner on 2026-10-15. Add-ons 4–6 can use those facts and existing application records without another server-data category. Add-on 7 needs a choice about historical application data.

### Proposed historical analytics

- Add one `application_stage_events` table: event ID, tracked-application foreign key, previous/current status and change timestamp. Store no notes, descriptions, messages, contacts or résumés. Enforce per-account access through the parent application's owner; cascade-delete events with their application/account.
- Capture an initial baseline for existing applications labelled as a baseline; never invent prior stages or application dates. Future status changes create events atomically with the update (database trigger) so a failed event write cannot silently distort the funnel.
- An account-only analytics page shows stage transitions, counts and source breakdowns with sample sizes, plus an in-app last-seven-days review. Missing history and current-state counts remain explicitly separate. No claim that a score/source caused an interview.
- Retain history while the parent application exists, until the user deletes it. No new scheduled cleanup service is proposed. This retention choice is explicit because an inactive account's history would otherwise remain stored.
- No scheduled job-board checks, email delivery or new external service. Production activation requires the additive migration and privacy disclosure to be reviewed with the feature.

### Smaller alternative

Show only current status counts, follow-ups due, applications added/applied in the last seven days and current time in stage from existing timestamps. No new table or historical conversion claims. This still provides a useful weekly review, but cannot show a true stage-transition funnel.

Approve historical events/retention, choose the current-data-only alternative, or defer analytics and proceed to CSV portability. This checkpoint follows the owner's request to approve substantial storage changes.

## Checkpoint 4: coach workspace / cross-account sharing

Historical analytics and retention were approved by the owner. Add-ons 2–9 are now implemented locally and undergoing combined release validation; monitoring remains deferred. Interview preparation uses local posting-grounded prompts, not a new AI service or added model spend.

The diagnostic's tenth, later-stage opportunity is a coach/career-center workspace. This is the largest remaining authorization change and stays unimplemented until approved.

### Proposed first version

- An application owner explicitly chooses one tracked application to share read-only. Share only title, company, posting link, current status, freshness at save and disclosed job facts. Never share preferences, private notes, follow-up drafts, account email, anonymous observations or other applications.
- Add one `coach_shares` table: share ID, parent application ID (cascade deletion), hashed random invitation secret, seven-day invitation expiry, optional recipient account ID, accepted time and revoked time. Store only the hash of the secret; do not log it or place it in a server-visible URL query. A recipient must sign in and explicitly accept; the invitation is single use and then bound to that account.
- The owner's details screen shows active/pending shares and recipient display names, with a revoke button. The coach workspace lists only accepted, unrevoked items bound to the coach's own account. Every server read rechecks the owner/application relationship and revocation. Revocation takes effect on the next request; it cannot erase information a recipient already copied.
- Access ends on revocation, deletion of the parent application/account, or deletion of the recipient account. Pending links expire after seven days. No team-admin powers, editing client applications, bulk client exports, contact lookup or coach messaging in this first version.
- Tests must prove that unrelated accounts, expired/reused invitations, revoked shares and tampered application IDs cannot reveal data. Apply no production migration or enable sharing until those tests and review pass.
- No new paid service or outbound message. The owner manually copies an invitation link. This creates an opt-in data-sharing/privacy surface and requires an updated disclosure; it does not change default application visibility.

Approve this read-only sharing model to proceed, or defer the coach workspace. Defer means add-ons 2–9 can be delivered without adding cross-account access. It does not authorize email notifications, monitoring or future coach write permissions.
