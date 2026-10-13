# Tasks

## 1. Domain helpers and API tests first

- [x] 1.1 Write failing Rust tests for seed catalog (宠物医院 present), unauthenticated 401, category/tag catalogs, and unknown-category 400
- [x] 1.2 Write failing Rust tests for search `q=宠物医院`, sort by distance vs rating, default origin distance_m, and haversine zero at the same point
- [x] 1.3 Write failing Rust tests for detail hours/phone, review create (201, rating_avg update), 501-char review 400, and correction `电话空号`
- [x] 1.4 Write failing Rust tests that a rejecting `Moderator` blocks review/publish (400, no row) and the no-op still allows
- [x] 1.5 Write failing Rust tests that privacy export includes local_reviews / local_services / local_corrections and delete cascades those rows without deleting seed services

## 2. Backend implementation

- [x] 2.1 Add `0006_local.sql` (tables + seed neighborhood; 0005 is M2 finance) and `api/src/local.rs`; implement validation, haversine, CRUD, moderation hook, and rating recompute until API tests pass
- [x] 2.2 Wire routes, extend `export_data`, and extend `api/openapi.yaml` for `/v1/local/*`
- [x] 2.3 Run `cargo fmt`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace` in `api/` until green

## 3. Frontend tests first

- [x] 3.1 Write failing Vitest cases for haversine/sort/search, category/tag catalogs, map-provider selection (webdriver/offline → stub), stub projection, and dark marker/background helpers
- [x] 3.2 Write failing Vitest cases for `MockQingxinApi` local methods (search 宠物医院, invalid category, review length, correction kind, export keys)
- [x] 3.3 Implement `web/src/lib/local/*` helpers and extend `QingxinApi` + mock until frontend unit tests pass

## 4. UI, offline, and evidence

- [x] 4.1 Build `/modules/local` (search, map/list toggle, categories, card, detail overlay with 拨打/导航, publish overlay, dark tiles + bright card borders, kit-only chrome, zh-CN) and wire IndexedDB cache + outbox types; exclude `local` from `[slug]` entries
- [x] 4.2 Add Playwright coverage for M4 map/list/detail at 390px and 1280px in light and dark; commit PNGs under `web/screenshots/`
- [x] 4.3 Run `npm test`, `npm run check`, `npm run lint`, and `npm run build` in `web/` and verify they exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #16` (not Closes). Do not merge.
