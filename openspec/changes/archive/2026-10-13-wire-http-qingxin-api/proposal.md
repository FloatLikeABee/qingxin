# Proposal

## Why

Final E2E found the web app never calls the Rust API: `getApi()` always returns `MockQingxinApi` (`web/src/lib/api/mock.ts`). Login, mood, local life, create, hustle, and home therefore round-trip only in localStorage. This is the foundation PR; later module HTTP clients reuse the same factory, session, and error mapping.

## What Changes

- Add `HttpQingxinApi` implementing the existing `QingxinApi` interface against `/v1` (auth/session, mood, local, create, hustle, toolbox SSE, export/delete).
- Select HTTP when `PUBLIC_API_URL` is set; keep `MockQingxinApi` for unit tests and when the env var is unset.
- Move `getApi()` / `resetApi()` to a documented factory so screens stop importing the mock class.
- Wire M1 mood, M4 local life, M9 create, M10 hustle, and home through that factory (they already call `getApi()`).
- Fix Settings showing 登录/注册 while a session exists; offer 退出登录 instead.
- Give finance, pets, wellness, and study the shared AppShell sidebar plus a 返回模块中心 link; visible page titles for finance (财务) and health (健康).
- Pin `rust-toolchain` to 1.88+ and Node `>=22` (`package.json` engines + README).
- Add Playwright E2E against the real API and a CI job that boots api + web.

## Capabilities

### New Capabilities

- None. This change extends existing capabilities.

### Modified Capabilities

- `api-client`: HTTP implementation, factory selection, snake_case mapping, token refresh.
- `app-shell`: Settings session chrome; module-app back links and titles.
- `compliance`: Login/register/logout against `/v1/auth` when HTTP is selected.

## Impact

- `web/src/lib/api/*` factory + HTTP client; screen imports; four module Chromes; toolchain files; `.github/workflows/qingxin.yml` E2E job.
- OpenAPI is the HTTP contract; no new Axum routes.
- Finance/pets/wellness/study keep their own stores; this PR only shares chrome. Toolbox methods are implemented on `HttpQingxinApi` so switching the factory does not break M5.
- Do not merge the PR (PO merges).
