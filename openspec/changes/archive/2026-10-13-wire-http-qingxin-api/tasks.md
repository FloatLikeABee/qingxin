# Tasks

## 1. Factory and HTTP client (tests first)

- [x] 1.1 Write failing Vitest cases for `readPublicApiUrl` (unset, blank, trailing slash) and `getApi()` selection (`MockQingxinApi` vs `HttpQingxinApi`) plus `resetApi`
- [x] 1.2 Implement `web/src/lib/api/env.ts` and `web/src/lib/api/client.ts`; stop exporting `getApi` from `mock.ts`; make those tests pass
- [x] 1.3 Write failing Vitest cases for `HttpQingxinApi` with a stub `fetch`: register/login/`getSession`/`/v1/me`, 401 refresh retry, logout, `ApiError` mapping, mood create/list camelCase, one hustle/local/create/tools mapping, SSE `runTool` delta+result
- [x] 1.4 Implement `web/src/lib/api/http.ts` (`HttpQingxinApi` implements the full `QingxinApi`) until those tests pass
- [x] 1.5 Point screens and stores at `#lib/api/client`; keep test files importing `MockQingxinApi` from `mock.ts`

## 2. Settings and module chrome (tests first)

- [x] 2.1 Write failing Playwright (or the smallest Vitest that can see the markup) expectations: Settings hides 登录 / 注册 when a session exists and shows 退出登录; finance/wellness have `h1` 财务/健康; finance/pets/wellness/study include 返回模块中心
- [x] 2.2 Update `settings/+page.svelte` and the four `*Chrome.svelte` files plus finance/wellness home titles until those tests pass

## 3. Toolchain and docs

- [x] 3.1 Pin `api/rust-toolchain.toml` and `api/crates/ai-gateway/rust-toolchain.toml` to `1.88.0`; set `rust-version = "1.88"`; point CI rust-toolchain actions at `1.88.0`
- [x] 3.2 Add `engines.node: ">=22"` to `web/package.json`; document Rust 1.88+ and Node >=22 plus `PUBLIC_API_URL` in root and `web/` README

## 4. Real-API Playwright and CI (tests first)

- [x] 4.1 Add `web/e2e/api.e2e.ts` and `web/playwright.api.config.ts` that register a unique user against a live API, assert Settings session chrome, mood round-trip, seeded 轻心宠物医院, and finance/health/pets/study chrome
- [x] 4.2 Add `e2e` job on `.github/workflows/qingxin.yml` that boots Axum (JWT/data/lookup keys, SQLite, `PORT=8080`), waits for `/health`, builds web with `PUBLIC_API_URL=http://127.0.0.1:8080`, installs Chromium, runs the API Playwright file
- [x] 4.3 Add `npm run test:e2e:api` script

## 5. Verification

- [x] 5.1 `cargo fmt --check --all`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, `cargo test --workspace` in `api/`
- [x] 5.2 `npm test`, `npm run check`, `npm run build` in `web/`
- [x] 5.3 Run API Playwright locally or in CI evidence; keep screenshot Playwright mock-only

## Workflow follow-up

- Archive the OpenSpec change after implementation.
- Open a PR whose body contains `Refs #27` (not Closes). Do not merge.
