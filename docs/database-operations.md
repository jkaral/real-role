# Database operations: migrations, verification, rollback

How Real Role's Postgres schema changes are applied, checked and (where possible) undone. It covers the add-on migrations in PR #24 (`0001`–`0003`). Written by Claude Code from #24's migration files, read-only; rehearsed on PGlite on 2026-10-16 (see [Rehearsal](#rehearsal)). **Production migrations and restores are owner actions**, done with the database provider's own tools.

## How migrations run

- Migrations live in `apps/web/drizzle/` and are generated with `pnpm --filter @real-role/web db:generate` (drizzle-kit). Drizzle records applied migrations in `drizzle.__drizzle_migrations` and applies each file once, in journal order.
- **Production:** the Vercel build command `build:vercel` runs `scripts/migrate.ts --production-only` before `next build`, but only when `VERCEL_ENV=production`. Preview deployments never migrate. The script prefers `DATABASE_URL_UNPOOLED`.
- **Locally:** `DATABASE_URL=… pnpm --filter @real-role/web db:migrate` (the script doesn't read `.env.local`).
- If a migration fails, the production build fails and the previous deployment keeps serving. Fix forward with a new migration; don't edit an applied one.

## Migration order

| File                                 | Adds                                                                                                                                                  | Touches existing data?                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_init`                          | Base schema: `users`, `accounts`, `sessions`, `verificationTokens`, `postings`, `observations`, `tracked_applications`, `rubric_cache`, `rate_limits` | n/a                                                                                                                                               |
| `0001_tranquil_gideon` (#24)         | `job_preferences` (per user), `tracked_job_facts` (per application)                                                                                   | No                                                                                                                                                |
| `0002_careful_masque` (#24)          | `application_stage_events`, an index, function `real_role_record_stage()` and trigger `real_role_stage_event` on `tracked_applications`               | **Yes:** inserts one `baseline = true` event per existing application (current status at `status_changed_at`). It doesn't invent earlier history. |
| `0003_steady_christian_walker` (#24) | `coach_shares` with a unique `invite_hash`                                                                                                            | No                                                                                                                                                |

All four are additive. No column is dropped, renamed or retyped, so code from before #24 still runs against the migrated schema.

**The trigger lives only in SQL.** `real_role_record_stage` and its trigger exist in `0002` but not in `src/db/schema.ts`. drizzle-kit won't drop them, but if migrations are ever regenerated or squashed, carry the function and trigger over by hand. Re-run the verification query for item 3 afterwards.

### Older application records

- Existing applications get exactly one baseline event, labelled `baseline = true`. Analytics treat it as "status at upgrade time", not as a transition.
- Their notes, dates and statuses are untouched. Job facts for them start empty ("unknown"); nothing is backfilled by fetching pages.
- After the upgrade, the trigger records an event only when `status` actually changes (`IS DISTINCT FROM`). Edits to notes or dates record nothing.

## Before a production migration

1. **Backup.** Make sure a restore point exists from just before the deploy. With Neon, that's a branch of the production database or the project's point-in-time restore window. Check your plan's retention in Neon's current docs, and note the exact time you deploy.
2. **Preview rehearsal.** Point a preview deployment, or a local run, at a **branch** of production (never production itself) and run `db:migrate`. Then run the verification queries below against that branch.
3. **Deploy order.** Merge, let the production build migrate, run the [deployment smoke test](deployment-runbook.md#smoke-test), and only then ship an extension that needs the new routes.

## Verification queries (production-safe)

They're read-only and return structure and counts only, never user records. Run them on the target database after migrating.

```sql
-- 1. Expected tables (13 after #24)
SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Foreign keys and delete rules: every row should be on_delete = 'c' (cascade)
SELECT conrelid::regclass AS child, confrelid::regclass AS parent, confdeltype AS on_delete
FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace ORDER BY 1, 2;

-- 3. Stage-event trigger and function present and enabled (tgenabled = 'O')
SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE NOT tgisinternal;
SELECT count(*) FROM pg_proc WHERE proname = 'real_role_record_stage';      -- 1

-- 4. Invite hashes are unique
SELECT conname FROM pg_constraint WHERE conrelid = 'coach_shares'::regclass AND contype = 'u';

-- 5. Counts only: right after 0002, baselines = applications; orphaned events must be 0
SELECT (SELECT count(*) FROM tracked_applications) AS applications,
       (SELECT count(*) FROM application_stage_events WHERE baseline) AS baselines,
       (SELECT count(*) FROM application_stage_events e
          LEFT JOIN tracked_applications a ON a.id = e.application_id WHERE a.id IS NULL) AS orphan_events;

-- 6. Migration ledger: 4 rows after #24
SELECT count(*) FROM drizzle.__drizzle_migrations;
```

Expected foreign keys after #24, all `ON DELETE CASCADE`:

| Child                      | Parent                                                   |
| -------------------------- | -------------------------------------------------------- |
| `accounts`, `sessions`     | `users`                                                  |
| `tracked_applications`     | `users`, `postings`                                      |
| `observations`             | `postings`                                               |
| `job_preferences`          | `users`                                                  |
| `tracked_job_facts`        | `tracked_applications`                                   |
| `application_stage_events` | `tracked_applications`                                   |
| `coach_shares`             | `tracked_applications` (owner side), `users` (recipient) |

To **test cascade deletion**, use a disposable branch only: create a fictional user with an application, preferences, facts and a coach share, delete the user, then re-run query 5 and count the add-on tables. Never delete real accounts to test.

## Rollback

| Situation                              | What to do                                                                                                                           | Reversible?                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bad add-on code, schema fine**       | Redeploy the previous production deployment in Vercel (instant), or revert the PR and redeploy.                                      | **Yes, with no data loss.** The old code ignores the new tables. The trigger keeps recording status events, which is harmless and keeps history consistent for a later re-release.                                      |
| **Hide one add-on**                    | Revert or hide its UI and routes in a follow-up PR. Leave its tables in place.                                                       | Yes. Stored preferences, facts, history and shares stay in the database (and are still deleted when their owner deletes the application or account) until the feature returns or the data is removed deliberately.      |
| **Remove an add-on's data on purpose** | A new migration that drops the table (or the trigger and function). Owner decision; update the privacy page in the same PR.          | **No.** Dropped preferences, facts, stage history or coach shares are gone. Back up first if they might be needed.                                                                                                      |
| **Migration itself caused damage**     | Restore the database to the pre-deploy point (Neon branch or point-in-time restore), and redeploy the code that matches that schema. | **Partly.** Everything written after the restore point is lost, across **all** tables, including new sign-ups, saved applications, status changes, notes and sightings. Prefer fixing forward unless data is corrupted. |

Reverting application code never reverts the database. Old code against the new schema is safe for #24, because every change is additive. The reverse isn't true: new code against the old schema fails on the missing tables, so never deploy #24's code without its migrations.

## Rehearsal

Rehearsed with PGlite (Postgres compiled to WebAssembly) using #24's migration files, on 2026-10-16:

- **Fresh schema** (`0000`→`0003`): the 13 tables, all foreign keys cascade, the trigger is enabled, the function exists, `coach_shares_invite_hash_unique` is present, and counts are 0/0/0.
- **Upgrade with data** (`0000`, three fictional applications for two users, then `0001`→`0003`): identical structure. Counts were 3 applications, 3 baselines and 0 orphans. A status change added one non-baseline event, and a notes-only edit added none. Existing notes were preserved.
- **Cascade:** deleting one user removed their 2 applications, their events, preferences, facts and the coach share they had issued. The other user's application and event remained, and shared `postings` rows remained.
- #24 also ships `apps/web/test/migration-upgrade.test.ts`, which checks the upgrade path in CI.

To repeat it: apply the SQL files in order with PGlite (`new PGlite()` then `exec(file)`, removing `--> statement-breakpoint` markers) or against a disposable Neon branch, then run the verification queries above.
