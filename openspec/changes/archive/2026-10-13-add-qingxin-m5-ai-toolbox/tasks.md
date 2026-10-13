# Tasks

## 1. Domain helpers and API tests first

- [x] 1.1 Write failing Rust tests for `GET /v1/tools` catalog (eight ids), unauthenticated 401, favourite toggle persist, and recent order after two runs
- [x] 1.2 Write failing Rust tests for summary run SSE (`text/event-stream`, `data:`, `event: result`, `[DONE]`), text/url/pdf input_kind, empty input 400, 32000+ char 400, and unknown tool 400
- [x] 1.3 Write failing Rust tests for meeting topics then decisions, decisions without topics 400, writing.weekly/daily/xhs + polish tones, unknown tone 400
- [x] 1.4 Write failing Rust tests for resume_jd score/matches/gaps (missing jd 400) and rename suggestions (two filenames)
- [x] 1.5 Write failing Rust tests that UnconfiguredAiGateway streams mock (`source` mock) and `QingxinAiGateway::mock` streams gateway text (`source` gateway)
- [x] 1.6 Write failing Rust tests that history lists newest first, filters by `tool_id`, isolates users, export includes `ai_tasks` and `templates`, and delete cascades those rows

## 2. Backend implementation

- [x] 2.1 Add `stream` to `AiGateway` (complete-based default) and `Gateway::stream_for_user`; add `futures` to `qingxin-api`; verify existing `cargo test --workspace` still compiles
- [x] 2.2 Add `0011_ai_tools.sql` and `api/src/tools.rs`; implement catalog, favourite upsert, SSE run, mock fallback, and history until API tests pass
- [x] 2.3 Wire `pub mod tools` and `.merge(crate::tools::routes())` append-only; extend `export_data` with `ai_tasks` and `templates`; extend `api/openapi.yaml` (tag, paths before `components:`, schemas at EOF, ExportPayload keys). Do not reformat shared files. Do not edit `nav.ts`
- [x] 2.4 Run `cargo fmt`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace` in `api/` until green

## 3. Frontend tests first

- [x] 3.1 Write failing Vitest cases for the eight-tool catalog, history filter helpers, markdown export string, and shimmer class name
- [x] 3.2 Write failing Vitest cases for `MockQingxinApi` toolbox methods (eight tools, isolation, favourite, summary todos, meeting two-step, resume score, rename length 2, export keys, unknown tool `invalid_request`)
- [x] 3.3 Implement `web/src/lib/tools/*` helpers and extend `QingxinApi` + mock until frontend unit tests pass

## 4. UI, offline, and evidence

- [x] 4.1 Build `/modules/ai` (工具 / 工作台 / 历史, left input / right SSE output, copy/export/retry, 思考中 shimmer, kit-only chrome, zh-CN); wire IndexedDB cache + outbox type `tools_favourite`; exclude `ai` from `[slug]`
- [x] 4.2 Add Playwright coverage for M5 screens at 390px and 1280px in light and dark; commit PNGs under `web/screenshots/`
- [x] 4.3 Run `npm test`, `npm run check`, `npm run lint`, and `npm run build` in `web/` and verify they exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #10` (not Closes). Do not merge.
