# Tasks

## 1. Domain helpers and API tests first

- [x] 1.1 Write failing Rust tests for note-length / emoji catalog validation and AES-GCM diary notes (ciphertext ≠ plaintext)
- [x] 1.2 Write failing Rust tests for check-in 201, unauthenticated 401, foreign-user isolation, tag filter, and 100-char rejection
- [x] 1.3 Write failing Rust tests for weekly/monthly trend aggregation and tag-filtered trends
- [x] 1.4 Write failing Rust tests for insight mock fallback, injected `AiGateway`, deterministic tag-order, monthly empty-state, and meditation session + catalog
- [x] 1.5 Write failing Rust tests that privacy export includes decrypted notes and delete cascades mood/meditation rows

## 2. Backend implementation

- [x] 2.1 Add `0002_mood.sql` and `api/src/mood.rs`; implement validation, encryption, CRUD, trends, insight, catalog, and sessions until API tests pass
- [x] 2.2 Wire routes, extend `export_data`, and extend `api/openapi.yaml` for `/v1/mood/*` and `/v1/meditation/*`
- [x] 2.3 Run `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` in `api/` until green

## 3. Frontend tests first

- [x] 3.1 Write failing Vitest cases for check-in validation, trend aggregation, deterministic insight + typewriter chunks, 4-7-8 phases, and `tel:12356`
- [x] 3.2 Write failing Vitest cases for `MockQingxinApi` mood/meditation methods (long note, insight disclaimer, catalog ids)
- [x] 3.3 Implement `web/src/lib/mood/*` helpers and extend `QingxinApi` + mock until frontend unit tests pass

## 4. UI, offline, and evidence

- [x] 4.1 Build `/modules/mood` (日记 / 趋势 / 冥想 tabs, overlays, kit-only chrome, zh-CN, dimmed glow) and wire IndexedDB cache + outbox types
- [x] 4.2 Add Playwright coverage for M1 screens at 390px and 1280px in light and dark; commit PNGs under `web/screenshots/`
- [x] 4.3 Run `npm test`, `npm run check`, and `npm run build` in `web/` and verify they exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #9` (not Closes). Do not merge.
