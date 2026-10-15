# Real Role demo

Run `pnpm demo:video` from the repository root. The command builds the real web app and demo extension, migrates and seeds a fresh local PGlite database, starts the app at `http://localhost:3100`, serves the three fictional postings at `http://127.0.0.1:4173`, records the real product flow, adds synthetic narration/captions and produces `demo/output/real-role-demo.mp4` at 1920×1080 (72 seconds).

## Prerequisites

- `pnpm install --frozen-lockfile`
- `pnpm --filter @real-role/demo exec playwright install chromium`
- `ffmpeg` and `ffprobe` on PATH, with libass/drawtext and H.264 support
- Free narration: `python -m pip install edge-tts`, with network access. `DEMO_PYTHON` selects Python. Alternatively set `OPENAI_API_KEY` to use `tts-1`/`alloy` through the [official speech endpoint](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).
- A workspace-local Python install also works: `python -m pip install --target demo/output/python edge-tts`. The pipeline detects it automatically. Set `DEMO_FONT_PATH` if Segoe UI (Windows) or DejaVu Sans (Linux) isn't installed.
- Local ports 3100 and 4173 must be free. Recording requires the product-readiness markers in `docs/HANDOFF.md`.

No external database, production sign-in, personal browser profile or production API access is used. The live URL in the end card comes from the handoff; all scoring/tracking traffic stays local. The pipeline creates a new database under ignored `demo/output/runs/<timestamp>` on each run and leaves it available for diagnostics. Existing databases are never deleted or reused. It overrides both database environment variables to that local database, disables the optional LLM call, and uses the web-owned guards for local demo seeding/sign-in.

## What the recording proves

The real built MV3 extension reads each fixture DOM. The recorder clicks its badge, opens the extension's own `sidepanel.html?tabId=...` with the real tab ID, and asserts score agreement, high/low/medium bands and all five signal rows. It signs in through the guarded local fictional-user endpoint, saves the fresh role through the extension, fetches the real applications API and verifies that exact saved row in the dashboard.

Chrome's native side panel is browser UI, outside Playwright page capture. The video therefore places actual screenshots of the posting and the standalone extension panel side by side, using Claude's supported recording hook. These are captured product pixels, not recreated HTML or mocked score responses. A neutral canvas composites the two views at 1920×1080. Timestamped frames preserve the real action timing; the dashboard then fills the full frame. Click rings are a recording overlay.

`output/assertions.json` records verified scores, saved application ID and frame count. `output/recording.ffconcat` references captured frames. A local cookie-only session file is written under ignored output and is never committed or published. Raw frames, databases, session files, narration intermediates and server logs stay under output; publish only the finished MP4.

## Fixture and seed tools

`pnpm --filter @real-role/demo demo:prepare` prepares HTML, `seed.json` and SRT captions without starting the product. `pnpm --filter @real-role/demo demo:serve` serves only the loopback fixture pages. Optional `DEMO_NOW` fixes the shared clock used by page dates and seed observations. Don't run the fixture server separately while the video command is running.

`pnpm --filter @real-role/demo demo:assemble` retries narration and assembly using the existing verified capture; it preserves that capture's posting dates and seed. Narration is measured and fitted to each interval without cutting off sentences. The default video command checks narration before starting the product flow.

The version-1 seed format is `{version,generatedAt,fixtures:[{slug,expectedBand,posting,fingerprint,roleKey,observations:[{sourceUrl,observedAt}]}]}`. It uses the shared fingerprint helpers and the web-owned `db:seed-demo` hook. Fresh/vague get one observation each; reposted gets five across sixty days. Tests validate the manifest, local serving and narration/caption timeline.

## Optional CI integration (Claude owns root CI)

The pipeline now provisions its own local database and fictional session. The manual optional job needs only these prerequisites before `pnpm demo:video`:

```yaml
- run: pnpm --filter @real-role/demo exec playwright install --with-deps chromium
- run: sudo apt-get update && sudo apt-get install -y ffmpeg python3-venv
- run: python3 -m venv /tmp/real-role-tts && /tmp/real-role-tts/bin/pip install edge-tts
- run: pnpm demo:video
  env:
    DEMO_PYTHON: /tmp/real-role-tts/bin/python
- uses: actions/upload-artifact@v4
  with:
    name: real-role-demo
    path: demo/output/real-role-demo.mp4
```

Keep the job manual and optional. Assertions and media generation failures still return nonzero. Do not upload the entire output directory, because it includes local session cookies. The recording browser uses Chromium's full headless mode with the real extension loaded; no display server is required.
