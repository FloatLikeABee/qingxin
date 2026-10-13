# Proposal

## Why

`/modules/ai` is still the T2 placeholder, so issue #10 and the Notion M5 card (tool grid, summary / meeting / writing / resume-vs-JD / rename, SSE workbench, history) have no product surface. T1, the AI gateway crate (SSE + MockProvider), T2, and the other nine modules are on `main`; this change fills the last MVP module behind the existing `AiGateway` seam.

## What Changes

- Add `ai_tasks` and `templates` (SQLite-first, Postgres-ready) and extend `api/openapi.yaml` under `/v1/tools/*` so the prefix does not collide with T1 `POST /v1/ai/complete`.
- Add an authenticated tool catalog (recent + favourites), SSE run for each MVP tool, task history by time and tool, and template favourite toggles. Privacy export includes both tables.
- Run every tool through `AiGateway::stream` (defaulting to `complete` for test doubles). If the gateway is `Unconfigured` (or empty), fall back to deterministic zh-CN copy streamed as SSE. No provider HTTP from this module.
- Extend `AiGateway` with an optional `stream` method. `QingxinAiGateway` maps to `Gateway::stream_for_user` and `encode_sse`. `/v1/ai/complete` stays the generic seam.
- Replace the `/modules/ai` placeholder with a zh-CN, mobile-first module that reuses the T2 kit, tokens, IndexedDB cache/outbox, and typed `QingxinApi`.
- Workbench: input left, SSE (or mock chunk) output right, copy / export / retry, shimmer 思考中 state until the first delta.
- Atmosphere stays on existing theme tokens. Do not add a second theme engine. Do not edit `nav.ts`.
- Shared files (router, OpenAPI, migrations, nav) stay append-only. Migration is `0011_ai_tools.sql` (`0010_create.sql` is on `main`).

## Capabilities

### New Capabilities

- `ai-toolbox`: Closed catalog of productivity tools (summary with todos, meeting topics-then-decisions, 周报/日报/小红书 writing, polish, resume-vs-JD, file-rename), SSE workbench, recent/favourite grid, and owner-scoped task history.

### Modified Capabilities

- `ai-seam`: Add `AiGateway::stream` with a default that chunks `complete`, used by toolbox runs.
- `api-client`: Add typed toolbox methods on `QingxinApi` and the mock, including a stream/iterator for the workbench.
- `app-shell`: 效率工具箱 is a real module at `/modules/ai`, not the generic placeholder.
- `privacy`: Export and account delete cover `ai_tasks` and `templates`.
- `offline-pwa`: Cache tasks/templates and enqueue favourite toggles in the existing outbox.

## Impact

- New migration `api/migrations/0011_ai_tools.sql`, `api/src/tools.rs`, tools tests, OpenAPI paths under `/v1/tools`, and `stream` on `api/src/ai.rs` plus `Gateway::stream_for_user`.
- New `web/src/lib/tools/` domain modules and `/modules/ai` UI; Playwright screenshots of M5 screens at 390px and 1280px in light and dark.
- Default `POST /v1/ai/complete` stays the gateway seam; this module does not change its contract.
- Shared hunks only: `lib.rs` module, router merge, export JSON keys, OpenAPI tag/paths/schemas/ExportPayload, `[slug]` exclusion, mock/types append. No `nav.ts` edits.
- `futures` added to `qingxin-api` so the HTTP layer can stream. No new provider crates, no PDF library, no URL fetcher, no deploy configs.
- No merge. PR body is `Refs #10`.
