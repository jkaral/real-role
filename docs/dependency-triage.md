# Dependency advisory triage

Checked on 2026-10-16 against `main` at `ecb57a1` (after #23), by Claude Code. Re-run before relying on this: advisories and the lockfile change.

## Summary

| Check                    | Result                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm audit --prod`      | **No known vulnerabilities** (production dependencies)                                                                               |
| `pnpm audit` (all deps)  | **1 moderate**: GHSA-67mh-4wv8-2f99 in `esbuild` 0.18.20                                                                             |
| Affected code at runtime | **None.** Dev-only tooling, and the vulnerable feature is never used                                                                 |
| Proposed fix             | One pnpm override (below). Rehearsed and passing. **Not applied**: it changes the shared lockfile, which Codex's PR #24 also changes |

## The advisory

- **ID:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), moderate.
- **Title:** "esbuild enables any website to send any requests to the development server and read the response".
- **Affected:** `esbuild` ≤ 0.24.2. **Patched:** ≥ 0.25.0.
- **What it is:** esbuild's built-in development server (`esbuild serve` / `context().serve()`) answered cross-origin requests with permissive CORS headers. While a developer runs that server, any website open in their browser could read its responses, such as their source code.

## Where it comes from

```
apps/web (devDependency)
└─ drizzle-kit 0.31.11            (its own esbuild is ^0.25.4: patched)
   └─ @esbuild-kit/esm-loader 2.6.5
      └─ @esbuild-kit/core-utils 3.3.2
         └─ esbuild 0.18.20       ← the only vulnerable copy
```

Every other esbuild in the tree is patched: 0.25.12 (drizzle-kit, tsx) and 0.28.2 (Vite, Vitest, WXT).

## Exposure

**Confirmed not affected:**

- **Production:** `drizzle-kit` is a devDependency of `apps/web`. Nothing from this chain is bundled into the web app or the extension. `pnpm audit --prod` is clean.
- **Development and CI:** `@esbuild-kit/core-utils` calls only esbuild's `transform` and `transformSync`, which compile TypeScript in memory. It never starts esbuild's development server, the only feature the advisory concerns. In this repo the chain runs only when `drizzle-kit` loads `drizzle.config.ts` (`pnpm --filter @real-role/web db:generate`).

**Hypothetical exposure:** a future change that starts `esbuild serve` from this old copy. Nothing in the repo does, and the fix below removes the copy entirely.

## Upgrade options

1. **Upgrade `drizzle-kit`: not available.** The latest stable release (0.31.11, already installed) still depends on `@esbuild-kit/esm-loader`. The 1.0 betas aren't suitable for production migrations.
2. **Override the transitive esbuild (proposed).** Add to `pnpm-workspace.yaml`:

   ```yaml
   overrides:
     "@esbuild-kit/core-utils>esbuild": "^0.25.0"
   ```

   It affects only that one parent, and nothing else's esbuild changes. Then run `pnpm install` to regenerate the lockfile.

3. **Do nothing.** Defensible, since it's not exploitable here, but it leaves a red advisory on the repo's security tab and noise in every future audit.

## Validation of the override (rehearsed 2026-10-16)

In a throwaway worktree of `main`:

| Step                                                     | Result                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Add the override, `pnpm install`                         | Lockfile: +4 / −229 lines. Removes `esbuild@0.18.20` and its 22 per-platform `@esbuild/*@0.18.20` binaries |
| `pnpm audit`                                             | **No known vulnerabilities**                                                                               |
| `pnpm --filter @real-role/web exec drizzle-kit generate` | Loads `drizzle.config.ts` through the overridden loader: "No schema changes, nothing to migrate"           |
| `pnpm check`                                             | 21/21 tasks pass                                                                                           |

**To apply** (after coordinating with Codex, who changes `pnpm-lock.yaml` in #24): merge #24 first, then on a fresh branch from `main` add the override, run `pnpm install`, and re-run the four steps above. In the same PR, run `drizzle-kit generate` against #24's schema to confirm it still reports no changes.

## Follow-ups

- `SECURITY.md` says "`pnpm audit --prod` is clean as of 2026-10-15". That's still true for production dependencies, but it doesn't mention this development-only advisory. Backlog task 7 updates it once the override decision is made.
- Re-run `pnpm audit --prod` and `pnpm audit` before each release.
