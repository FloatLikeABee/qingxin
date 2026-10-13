# Proposal

## Why

T1 (`api/`) and T2 (`web/`) are on `main`, but the mood module is still a placeholder. Issue #9 and the Notion M1 card require a usable 情绪日记 + 冥想 MVP: encrypted check-ins, trends, stubbed AI insight, breathing / noise / story / timer, and a confirmed crisis hotline. Echo's gateway (issue #3 / PR #6) is not ready, so every model call stays behind `AiGateway` with a deterministic mock.

## What Changes

- Add `mood_logs` and `meditation_sessions` (SQLite-first, Postgres-ready) and extend `api/openapi.yaml`.
- Persist diary notes with T1 AES-256-GCM; keep emoji/score/tags plaintext so charts and tag filters work without decrypting the table.
- Add authenticated mood and meditation HTTP routes; include those rows (notes decrypted) in privacy export.
- Stub AI insight and monthly summary through `AiGateway::complete`. If the gateway is `Unconfigured`, fall back to a deterministic empathetic mock. No provider HTTP, no real model calls.
- Replace the `/modules/mood` placeholder with a zh-CN, mobile-first module that reuses the T2 kit, tokens, IndexedDB cache/outbox, and typed `QingxinApi`.
- Ship check-in (emoji + tag cloud + note `<100` chars), weekly/monthly SVG trends with tag filter, typewriter insight + non-medical disclaimer, 4-7-8 breathing, Web Audio white-noise mixer, bedtime-story reader, fullscreen timer, and a one-tap 12356 hotline behind a confirmation modal.
- Atmosphere stays on existing theme tokens: soft light, deep blue-grey dark, dimmed glow. Do not add a second theme engine.

## Capabilities

### New Capabilities

- `mood-journal`: Check-in, encrypted notes, list, and weekly/monthly trends with tag filter.
- `mood-insights`: Empathetic insight and monthly summary via the `AiGateway` seam plus a deterministic mock.
- `meditation`: 4-7-8 breathing, white-noise mixer, bedtime story, fullscreen timer, and session persistence.
- `crisis-hotline`: One-tap 12356 call only after an explicit confirmation.

### Modified Capabilities

- `api-client`: Add typed mood/meditation/insight methods on `QingxinApi` and the mock.
- `field-encryption`: Diary `note` is AES-GCM at rest, same as phone.
- `privacy`: Export and account delete cover mood and meditation rows.
- `offline-pwa`: Cache mood/meditation records and enqueue check-ins / sessions in the existing outbox.

## Impact

- New migration `api/migrations/0002_mood.sql`, `api/src/mood.rs`, mood tests, and OpenAPI paths under `/v1/mood` and `/v1/meditation`.
- New `web/src/lib/mood/` domain modules and `/modules/mood` UI; Playwright screenshots of M1 screens.
- Default `POST /v1/ai/complete` stays 501 `ai_unconfigured` so Echo's gateway PR does not collide.
- No merge. PR body is `Refs #9`.
