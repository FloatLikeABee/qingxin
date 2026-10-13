# Tasks

## 1. Domain helpers and API tests first

- [x] 1.1 Write failing Rust tests for creation create/list/patch, client UUID idempotency, isolation, missing-platform/empty-content 400, and version append
- [x] 1.2 Write failing Rust tests for snippet create, unauthenticated 401, foreign-user isolation, empty content 400, unknown kind 400, and use increment
- [x] 1.3 Write failing Rust tests for template catalog (four platforms) and platform filter; unknown platform 400
- [x] 1.4 Write failing Rust tests for generate / titles (exactly 10) / polish / outline mock fallback, injected `AiGateway`, deterministic output, and invalid tone/platform 400
- [x] 1.5 Write failing Rust tests that privacy export includes creations and snippets, and delete cascades those rows

## 2. Backend implementation

- [x] 2.1 Add `0010_create.sql` and `api/src/create.rs`; implement validation, CRUD, catalogs, and AI stubs until API tests pass
- [x] 2.2 Wire `pub mod create` and `.merge(crate::create::routes())` append-only; extend `export_data` with `creations` and `snippets`; extend `api/openapi.yaml` (tag, paths before `components:`, schemas at EOF, ExportPayload keys). Do not reformat shared files. Do not edit `nav.ts`
- [x] 2.3 Run `cargo fmt`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace` in `api/` until green

## 3. Frontend tests first

- [x] 3.1 Write failing Vitest cases for platform/tone/length catalogs, `diffLines`, dark-editor class/colors, variable highlighting, `outlineToMarkdown`, and `outlineToPptx` ZIP contents
- [x] 3.2 Write failing Vitest cases for `MockQingxinApi` create methods (platforms, isolation, titles length 10, AI disclaimer/source, snippet usage, export keys)
- [x] 3.3 Implement `web/src/lib/create/*` helpers and extend `QingxinApi` + mock until frontend unit tests pass

## 4. UI, offline, and evidence

- [x] 4.1 Build `/modules/create` (创作 / 模板 / 作品, dark editor island, platform previews, diff, snippet library, kit-only chrome, zh-CN); wire IndexedDB cache + outbox type `create_work_create`; append home scenario cards + inspiration feed
- [x] 4.2 Add Playwright coverage for M9 screens at 390px and 1280px in light and dark; commit PNGs under `web/screenshots/`
- [x] 4.3 Run `npm test`, `npm run check`, `npm run lint`, and `npm run build` in `web/` and verify they exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #23` (not Closes). Do not merge.
