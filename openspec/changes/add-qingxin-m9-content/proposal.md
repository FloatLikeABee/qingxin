# Proposal

## Why

`/modules/create` is still the T2 placeholder, so issue #23 and the Notion M9 card (平台模板、标题、润色、PPT 大纲、片段库、分栏编辑器) have no product surface. T1, the AI gateway crate, T2, M1, M10, and M7 are on `main`; this change fills the content-creation module behind the existing `AiGateway` seam with a deterministic stub.

## What Changes

- Add `creations` and `snippets` (SQLite-first, Postgres-ready) and extend `api/openapi.yaml` under `/v1/create/*` so the prefix does not collide with T1 `/v1/ai` or M5's future toolbox.
- Add authenticated CRUD for works and snippets, a closed platform-template catalog, title generation, polish rewrite, PPT outline, inspiration feed, and version snapshots. Privacy export includes both tables.
- Stub generate / titles / polish / outline through `AiGateway::complete`. If the gateway is `Unconfigured` (or empty), fall back to deterministic zh-CN copy. No provider HTTP from this module.
- Replace the `/modules/create` placeholder with a zh-CN, mobile-first module that reuses the T2 kit, tokens, IndexedDB cache/outbox, and typed `QingxinApi`.
- Editor: split view (prompt config | live preview) with diff, IDE-like dark editor island and `{{变量}}` highlighting, platform-style previews (小红书 card, 公众号 layout, 抖音 caption, 周报).
- Template library (filter, preview, one-click use), works page (version history + Markdown/PPTX export), snippet library (phrases/quotes/cases).
- Home shows scenario cards and an inspiration feed.
- Atmosphere stays on existing theme tokens. Do not add a second theme engine. Do not edit `nav.ts`.
- Shared files (router, OpenAPI, migrations, nav) stay append-only because M4 PR #20 is in flight. Migration is `0007_create.sql` (next free after `0006_wellness.sql` on current `main`).

## Capabilities

### New Capabilities

- `content-studio`: Platform templates, generate/titles/polish flow, dark split editor with diff and platform preview, works with version history.
- `snippet-library`: Owner-scoped phrases, quotes, and cases with tags and usage counts.
- `ppt-outline`: Topic to structured outline, Markdown export, client-side PPTX export.

### Modified Capabilities

- `api-client`: Add typed create methods on `QingxinApi` and the mock.
- `app-shell`: Home includes scenario cards and an inspiration feed; 内容创作 is a real module, not a placeholder.
- `theming`: Editor island stays dark (IDE-like) regardless of page theme; platform previews keep their own light mock surfaces.
- `privacy`: Export and account delete cover creations and snippets.
- `offline-pwa`: Cache creations/snippets and enqueue creates in the existing outbox.

## Impact

- New migration `api/migrations/0007_create.sql`, `api/src/create.rs`, create tests, and OpenAPI paths under `/v1/create`.
- New `web/src/lib/create/` domain modules and `/modules/create` UI; Playwright screenshots of M9 screens at 390px and 1280px in light and dark.
- Default `POST /v1/ai/complete` stays the gateway seam; this module does not change it.
- Shared hunks only: `lib.rs` module, router merge, export JSON keys, OpenAPI tag/paths/schemas/ExportPayload, `[slug]` exclusion, home card, mock/types append. No `nav.ts` edits.
- No merge. PR body is `Refs #23`.
