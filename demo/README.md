# Demo pipeline

## Prepare now

`pnpm --filter @real-role/demo demo:prepare` generates three fictional HTML pages, `output/seed.json`, and timed SRT captions. `pnpm --filter @real-role/demo demo:serve` serves the same pages on loopback port 4173. Set `DEMO_NOW` to the same ISO timestamp for reproducibility. No real job-board requests are made.

## Integration checkpoint

Final recording waits for both exact handoff markers: `extension build ready for demo` and `web app live at https://...`. Do not add those markers until the product is ready. The current scaffolds cannot supply a final video.

Claude-owned integration requirements:

1. `apps/web` script `db:seed-demo <manifest>` reads a repo-root-relative manifest path, validates version 1, upserts fixture postings and observations, and refuses production databases. Format: `{version:1, generatedAt, fixtures:[{slug,expectedBand,posting,fingerprint,roleKey,observations:[{sourceUrl,observedAt}]}]}`. Fingerprints and role keys use shared helpers. Preserve distinct URL/day observations, and make seeding idempotent.
2. Serve the built extension from `apps/extension/.output/chrome-mv3` (override `DEMO_EXTENSION_PATH`). It must allow the loopback fixture origin and point at the demo API environment. `DEMO_WEB_URL` can override the recorded web environment; the end card always shows the live URL in the handoff.
3. Provide `DEMO_STORAGE_STATE`, a Playwright storage-state JSON for an isolated fictional demo account. The recorder loads cookies only. Never commit session files or use personal browsing profiles. Tracking must use actual API/auth behavior.
4. The recorder currently expects the panel test IDs inside the recorded page. If the extension uses a native `chrome.sidePanel`, adapt capture after its implementation is available: Playwright page videos do not include native browser chrome. It intentionally fails if the panel isn't visible in the recording. Do not claim native panel capture is implemented.
5. Verify the three expected bands with the real scoring engine and seed. ATS is unknown on these local fixtures; no network evidence or scores are fabricated. If medium needs adjustment, update fictional description/age and assertions together.

## Record when ready

Install Chromium with `pnpm --filter @real-role/demo exec playwright install chromium`. Install ffmpeg with libass and drawtext support and place it on PATH. For free narration install `python -m pip install edge-tts` (network required at generation time), or set `OPENAI_API_KEY` to use OpenAI `tts-1`. Optional `DEMO_PYTHON` selects a Python executable. An API key enables paid narration only when explicitly supplied.

The optional speech request follows the [official OpenAI speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create), checked on 2026-10-14. No paid speech request is needed for fixture preparation or tests.

Run `pnpm demo:video`. The pipeline prepares inputs, runs the web-owned seed hook, launches Chromium with the real extension, records 1920×1080 UI with visible click rings and assertions, generates narration, and assembles captions and title/end cards into `output/real-role-demo.mp4` (72 seconds). Child processes receive argument arrays, without interpolating secrets. Assertions fail the command; missing dependencies never produce a substitute video.

## Optional CI job (Claude applies; CI is Claude-owned)

The root workflow already has a manual optional demo job. Add these prerequisites there after integration:

```yaml
- run: pnpm --filter @real-role/extension build
- run: pnpm --filter @real-role/demo exec playwright install --with-deps chromium
- run: sudo apt-get update && sudo apt-get install -y ffmpeg python3-pip
- run: python3 -m pip install edge-tts
- run: xvfb-run --auto-servernum pnpm demo:video
  env:
    DEMO_PYTHON: python3
    DEMO_WEB_URL: ${{ vars.DEMO_WEB_URL }}
    DEMO_STORAGE_STATE: /tmp/real-role-demo-session.json
- uses: actions/upload-artifact@v4
  with:
    name: real-role-demo
    path: demo/output/real-role-demo.mp4
```

Before these steps, provision the isolated database, seed credentials and session file through the web-owned demo auth mechanism. This snippet alone does not provision auth or a database. Keep the job manual and optional; its recorded-run assertions must still fail the job when the product behavior is wrong.
