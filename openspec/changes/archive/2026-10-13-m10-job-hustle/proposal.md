# Proposal

## Why

T1 (`api/`), the AI gateway crate, T2 (`web/`), and M1 are on `main`, but 求职副业 is still a hub placeholder. Issue #13 and the Notion M10 card require a usable 简历工坊, 求职看板, 面试题库, 副业灵感, 报价计算器, and a home job-status overview. Echo owns real model calls, so resume optimize, mock interviewer, and side-hustle suggestions stay behind `AiGateway` with a deterministic mock.

## What Changes

- Add `applications`, `resumes`, and `side_hustles` (SQLite-first, Postgres-ready) and extend `api/openapi.yaml` under `/v1/hustle/*` so the prefix does not collide with T1 `/v1/jobs` (scheduler).
- Add authenticated CRUD, kanban status moves, funnel aggregation, a closed interview catalog, and quote math. Privacy export includes the three tables.
- Stub resume optimize, mock interviewer, and side-hustle suggestions through `AiGateway::complete`. If the gateway is `Unconfigured` (or empty), fall back to deterministic zh-CN copy. No provider HTTP from this module.
- Replace the `/modules/hustle` placeholder with a zh-CN, mobile-first module that reuses the T2 kit, tokens, IndexedDB cache/outbox, and typed `QingxinApi`.
- Resume workshop: form editor, multi-version, live A4 preview that is always light, print-based PDF export.
- Kanban: 投递 / 面试 / Offer with drag-drop plus a mobile status control, SVG funnel, interview 复盘 notes. Dark mode uses deeper card shadows and highlighted status tags.
- Home shows job-status counts and today's interview/application todos.
- Atmosphere stays on existing theme tokens. Do not add a second theme engine.

## Capabilities

### New Capabilities

- `resume-workshop`: Form editor, versions, always-light A4 preview, PDF export, AI optimize stub.
- `job-board`: Application kanban, funnel, interview retros, home todos.
- `interview-prep`: Role/difficulty question bank and AI mock interviewer stub.
- `side-hustle`: Filtered idea cards, skills/time suggestions, income estimate, quote calculator.

### Modified Capabilities

- `api-client`: Add typed hustle methods on `QingxinApi` and the mock.
- `app-shell`: Home includes job-status overview and today's todos; hustle is a real module, not a placeholder.
- `theming`: Resume preview stays light; kanban cards get deeper dark shadows and highlighted status tags.
- `privacy`: Export and account delete cover applications, resumes, and side hustles.
- `offline-pwa`: Cache hustle records and enqueue creates/updates in the existing outbox.

## Impact

- New migration `api/migrations/0004_hustle.sql`, `api/src/hustle.rs`, hustle tests, and OpenAPI paths under `/v1/hustle`.
- New `web/src/lib/hustle/` domain modules and `/modules/hustle` UI; Playwright screenshots of M10 screens at 390px and 1280px in light and dark.
- Default `POST /v1/ai/complete` stays the gateway seam; this module does not change it.
- No merge. PR body is `Refs #13`.
