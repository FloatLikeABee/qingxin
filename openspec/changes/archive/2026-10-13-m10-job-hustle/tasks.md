# Tasks

## 1. Domain helpers and API tests first

- [x] 1.1 Write failing Rust tests for resume create/list/update, version increment, isolation, and missing-name 400
- [x] 1.2 Write failing Rust tests for application create, unauthenticated 401, foreign-user isolation, status move (投递/面试/Offer), invalid status 400, and interview notes
- [x] 1.3 Write failing Rust tests for funnel counts, side-hustle filters (线上/线下/技能型), and question catalog role/difficulty filters
- [x] 1.4 Write failing Rust tests for resume-optimize / mock-interviewer / side-hustle-suggest mock fallback, injected `AiGateway`, and deterministic output
- [x] 1.5 Write failing Rust tests that privacy export includes applications, resumes, and side_hustles, and delete cascades those rows

## 2. Backend implementation

- [x] 2.1 Add `0004_hustle.sql` and `api/src/hustle.rs`; implement validation, CRUD, funnel, catalog, quote-adjacent AI stubs until API tests pass
- [x] 2.2 Wire routes, extend `export_data`, and extend `api/openapi.yaml` for `/v1/hustle/*`
- [x] 2.3 Run `cargo fmt`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace` in `api/` until green

## 3. Frontend tests first

- [x] 3.1 Write failing Vitest cases for resume validation, always-light A4 class/colors, printable HTML, quote formula, funnel aggregation, kanban status moves, and side-hustle filters
- [x] 3.2 Write failing Vitest cases for `MockQingxinApi` hustle methods (status, isolation, AI disclaimer/source, question filters)
- [x] 3.3 Implement `web/src/lib/hustle/*` helpers and extend `QingxinApi` + mock until frontend unit tests pass

## 4. UI, offline, and evidence

- [x] 4.1 Build `/modules/hustle` (求职 / 副业 / 今日, inner chips, A4 light preview, kanban shadows + highlighted tags, kit-only chrome, zh-CN) and wire IndexedDB cache + outbox types; update home overview
- [x] 4.2 Add Playwright coverage for M10 screens at 390px and 1280px in light and dark; commit PNGs under `web/screenshots/`
- [x] 4.3 Run `npm test`, `npm run check`, `npm run lint`, and `npm run build` in `web/` and verify they exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #13` (not Closes). Do not merge.
