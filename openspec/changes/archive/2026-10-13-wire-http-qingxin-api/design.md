# Design

## Context

See proposal.md — Why. Issue #27 is the spec. `main` (including M5) has T1 at `api/` (Axum, JWT access + hashed refresh, `GET /v1/me`, CORS permissive, OpenAPI at `api/openapi.yaml`) and T2 at `web/` (SvelteKit static adapter, `QingxinApi` + `MockQingxinApi`, screens import `getApi` from `#lib/api/mock`). `getApi()` always constructs the mock. Settings always renders 登录 / 注册. Finance/pets/wellness/study sit under AppShell already but their Chromes have no 返回模块中心; finance and wellness lack visible `h1` titles. `api/rust-toolchain.toml` is `stable`; `Cargo.toml` `rust-version` is `1.85`; `web/package.json` has no `engines`.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per major decision, checked against the live tree.

## Goals / Non-Goals

**Goals:**

- One typed `QingxinApi` with two implementations: mock (tests / unset URL) and HTTP (`PUBLIC_API_URL`).
- Auth/session against `/v1/auth/*` and `/v1/me`; Bearer access token; refresh on 401.
- Mood, local, create, hustle, home (and toolbox, because it is on the same interface) round-trip through Axum when the URL is set.
- Settings reflects the live session; module apps that live outside `/modules/*` still look like part of the shell.
- Toolchain floors: Rust 1.88+, Node >=22. Playwright E2E in CI against a booted api+web.

**Non-Goals:**

- Rewriting finance/pets/wellness/study onto `QingxinApi` (they keep module-local stores).
- Changing Axum JSON to camelCase or generating a client from OpenAPI this PR.
- HttpOnly cookie auth, SMS login UI, or a second SPA build flavor.
- Merging the PR (PO merges).

## Decisions

### D1 — When `getApi()` returns HTTP vs mock

**Chosen:** If `PUBLIC_API_URL` is a non-empty string (Vite/`import.meta.env`, trimmed, no trailing slash), construct `HttpQingxinApi`. Otherwise `MockQingxinApi`. Unit tests keep calling `resetApi(new MockQingxinApi())` (default). Screenshot Playwright stays on the mock (no env var). The real-API Playwright job sets the env var at web build time because the static adapter inlines `PUBLIC_*`.

**Assumptions challenged:** “Always HTTP now that T1 exists.” Screenshot E2E seeds `qingxin.session` with `mock-token-demo` and expects seeded mood/hustle rows that the empty SQLite DB does not have.

**Rejected:**

1. **Always `HttpQingxinApi`** — unit tests and screenshot E2E would need a live API or MSW for every suite; the issue explicitly keeps the mock for tests and unset URL.
2. **Runtime query `?api=` or a Settings toggle** — two sources of truth, easy to ship a production build still on mock, hard to test.
3. **Vite proxy `/v1` → Axum with HTTP always** — static `adapter-static` preview and production CDN have no proxy; CI screenshots would hit an empty API.
4. **Compile-time `#ifdef` two apps** — doubles CI matrix; the factory is one function.

**Grill:** *Does `PUBLIC_API_URL` work with `$env/static/public` when unset?* Treat missing/blank as mock; do not fail the build. *SvelteKit `$env/dynamic/public` vs `import.meta.env`?* Read `import.meta.env.PUBLIC_API_URL` in a tiny `env.ts` so Vitest can `stubEnv` without importing `$env`. *Trailing slash?* Strip it so `/v1/me` is not `//v1/me`.

### D2 — Client module layout

**Chosen:** Keep `types.ts` as the public contract. `mock.ts` is only `MockQingxinApi`. New `http.ts` is `HttpQingxinApi`. New `client.ts` owns `getApi` / `resetApi` and documents the selection rule. Screens import `getApi` from `#lib/api/client` (or `#lib/api/mock` re-exports removed). Tests that need the mock class still import `MockQingxinApi` from `mock.ts`.

**Assumptions challenged:** T2 left `getApi` inside `mock.ts`, so every screen already depends on the mock module path.

**Rejected:**

1. **Leave `getApi` in `mock.ts` and add an `if` there** — the mock file stays the import path forever; the issue asks for a clean, documented interface.
2. **`openapi-typescript` codegen as the app API** — generated names are snake_case, screens already speak camelCase `QingxinApi`, and codegen would churn on every OpenAPI edit.
3. **Per-module HTTP clients only (M7 finance style)** — mood/local/create/hustle already sit on `QingxinApi`; splitting now rewrites every screen. Later modules may add clients; this foundation is the shared one.
4. **GraphQL or tRPC layer** — T1 is Axum/OpenAPI.

**Grill:** *Will `#lib/api` directory index resolve?* Existing imports are `#lib/api/mock`; use `#lib/api/client` rather than a bare `#lib/api` directory import. *Re-export `getApi` from `mock.ts` for compatibility?* No — that hides the bug. Update call sites.

### D3 — Session and tokens

**Chosen:** Extend `Session` with optional `refreshToken`. Persist the same `qingxin.session` localStorage key. `login`/`register` store access + refresh from `TokenResponse`. `getSession()` restores from storage, then `GET /v1/me` to confirm; on 401, `POST /v1/auth/refresh` once and retry; on failure, clear storage and return `null` (never throw). `logout` posts the refresh token then clears. Access TTL is 900s, so refresh is mandatory.

**Assumptions challenged:** Mock `Session.token` is a fake string and `getSession()` never hits the network. Real JWTs expire.

**Rejected:**

1. **Access token only** — users would drop out every 15 minutes; logout could not revoke the refresh family.
2. **HttpOnly cookies** — the API issues JSON Bearer tokens, not `Set-Cookie`. Changing T1 is out of scope.
3. **In-memory tokens only** — a reload would look logged out; Settings is the first place that bug shows up.
4. **Refresh on an interval timer** — extra timers in a PWA; 401-driven refresh is enough.

**Grill:** *Mock sessions in screenshot E2E have no `refreshToken`.* Those runs do not set `PUBLIC_API_URL`. *Register body needs `consent.policy_version`.* HTTP register sends `{ email, password, display_name, consent: { policy_version: "2026-10-13" } }`; mock register stays a three-arg method so screens do not change. *API password minLength 8 vs mock 6?* Keep mock rules; HTTP surfaces API 400. E2E uses 8+ characters.

### D4 — JSON mapping

**Chosen:** `HttpQingxinApi` maps OpenAPI snake_case envelopes to the existing camelCase `QingxinApi` types at the boundary (e.g. `created_at` → `createdAt`, `rating_avg` → `ratingAvg`, `{ items }` lists → arrays). Nested blobs that the API stores as opaque JSON (`resume.content`, creation `prompt_params`) pass through. Errors map `{ error: { code, message } }` to `ApiError`. Network failures become `unavailable`.

**Assumptions challenged:** “Just `as QingxinApi` the JSON.” Field names disagree in dozens of places; screens would show `undefined`.

**Rejected:**

1. **Change `QingxinApi` to snake_case** — every Svelte page and store breaks.
2. **Change Axum to camelCase** — OpenAPI and every Rust test would move; this is a web foundation PR.
3. **A generic recursive camelCase converter** — would rewrite `ResumeContent` keys if the API ever echoed snake_case inside `content`, and would hide mapping mistakes.
4. **Duplicate TypeScript types per wire shape** — the interface exists so screens do not see wire types.

**Grill:** *Export shape differs (API `exported_at` + `user` vs client `exportedAt` + `data`).* Map into `ExportPayload` so Settings download stays stable. Include `mood_logs`, hustle collections, local, create, and `ai_tasks` when present. *List endpoints return `{ items }`.* Unwrap in the client.

### D5 — Settings chrome while logged in

**Chosen:** If `getSession()` returns a session, Settings shows `已登录：{displayName}`, hides the 登录 / 注册 row, and shows 退出登录 that calls `logout()`. Logged-out state keeps 登录 / 注册.

**Assumptions challenged:** The heading already switches to `已登录`, so maybe the list row is fine. Issue #27 names that row as the bug.

**Rejected:**

1. **Keep the login row always** — that is the reported bug.
2. **Redirect `/login` to `/settings` when already logged in** — extra routing; does not fix the Settings list.
3. **Modal auth instead of `/login` and `/register`** — out of scope; existing routes stay.

**Grill:** *After HTTP login, `goto('/settings')` must see the same singleton.* `getApi()` is a module singleton; persist tokens before returning from `login`.

### D6 — Finance / pets / wellness / study chrome

**Chosen:** They already render inside root `AppShell` (desktop left sidebar, phone tabs). Add `← 返回模块中心` (`href="/modules"`) to `FinanceChrome`, `PetsChrome`, `WellnessChrome`, and `StudyChrome`. Add visible `h1` 财务 on `/finance` and `h1` 健康 on `/wellness`. Do not move routes; `/modules/finance` etc. already redirect.

**Assumptions challenged:** “Shared left sidebar” might mean a second inner sidebar of module links. Those Chromes already use a chip nav; duplicating AppShell would nest two sidebars.

**Rejected:**

1. **Replace chip nav with a second left sidebar** — fights AppShell at `md+` and wastes phone width.
2. **Move URLs to `/modules/finance` (etc.)** — breaks bookmarks and existing redirects.
3. **Hide AppShell on those routes and invent module-only chrome** — that is the opposite of “shared left sidebar”.

**Grill:** *Elder?* Out of issue scope. *svelte:head already says 轻心 · 财务 / 健康.* The gap is the visible `h1`, matching mood/pets.

### D7 — Playwright vs the real API

**Chosen:** New `web/e2e/api.e2e.ts` + `web/playwright.api.config.ts`. Existing screenshot config stays mock-only. CI job `e2e` in `.github/workflows/qingxin.yml` starts Axum with test secrets and SQLite, waits on `GET /health`, builds web with `PUBLIC_API_URL=http://127.0.0.1:8080`, installs Chromium, runs the API Playwright file. Tests register a unique user (not the mock demo password), then assert Settings, a mood create round-trip, seeded 轻心宠物医院, and chrome on finance/health/pets/study.

**Assumptions challenged:** Reuse `playwright.config.ts` for both. Screenshot tests would fail against an empty database.

**Rejected:**

1. **One Playwright project for screenshots and API** — mock session token is not a JWT; seeded copy differs.
2. **MSW in E2E** — would not prove Axum is in the loop; the issue wants the real API.
3. **Only `curl /health` in CI** — does not prove `getApi()` selection or Settings.

**Grill:** *Static adapter inlines `PUBLIC_API_URL` at build.* The job must export it for `npm run build`, not only for the Playwright process. *Playwright `webServer` compiling Rust?* No — CI starts `cargo run` first; Playwright only serves the web build.

### D8 — Toolchain pins

**Chosen:** `api/rust-toolchain.toml` and `api/crates/ai-gateway/rust-toolchain.toml` `channel = "1.88.0"` with rustfmt/clippy. `rust-version = "1.88"` in both Cargo.toml files. CI `dtolnay/rust-toolchain@1.88.0`. `web/package.json` `"engines": { "node": ">=22" }`. Root and web README state Rust 1.88+ and Node >=22.

**Assumptions challenged:** Pinning `stable` already gets “latest”. Issue asks for an explicit 1.88 floor so CI cannot silently drop below.

**Rejected:**

1. **Keep `channel = "stable"` and only set `rust-version`** — rustup still installs whatever stable is; the issue names `rust-toolchain`.
2. **Pin Node 20** — below the stated floor; current `setup-node` is already 22.
3. **README-only documentation** — engines/toolchain are what CI and rustup honor.

**Grill:** *Local image is rustc 1.83.* rustup reads `rust-toolchain.toml` and downloads 1.88.0. *1.88 vs 1.88.0?* Use `1.88.0` so CI and rustup match.

### D9 — Full interface including M5 toolbox

**Chosen:** `HttpQingxinApi` implements every `QingxinApi` method, including `listTools` / `runTool` SSE, even though issue text lists M1/M4/M9/M10/home. M5 screens already call `getApi()`; a partial class would not typecheck and would break `/modules/ai` the moment HTTP is selected.

**Rejected:**

1. **Stub toolbox methods with `unavailable`** — `/modules/ai` would regress when `PUBLIC_API_URL` is set.
2. **Split `QingxinApi` into per-module interfaces this PR** — larger than the issue; later work can still split.
3. **Leave M5 on a second mock singleton** — two clients, two sessions.

**Grill:** *SSE framing is OpenAI-style `data:` plus `event: result`.* Parse both; yield `{ type: 'delta' }` from `choices[0].delta.content` and `{ type: 'result', task }` from the result event.

## Risks / Trade-offs

- **[Risk] Static adapter bakes `PUBLIC_API_URL`** → Mitigation: document it; CI builds with the var; local `npm run dev` can set it.
- **[Risk] Mock and HTTP diverge** → Mitigation: one interface; HTTP tests cover mapping; mock stays for unit tests.
- **[Risk] Screenshot E2E accidentally gets HTTP** → Mitigation: default Playwright config does not set the var.
- **[Risk] rustup 1.88.0 missing on a runner** → Mitigation: `dtolnay/rust-toolchain@1.88.0` installs it; rust-version matches.

## Migration Plan

1. Land factory + HTTP + chrome + toolchain + E2E job on this branch.
2. Production/preview deploys set `PUBLIC_API_URL` to the Axum origin.
3. Rollback: unset the env var; `getApi()` returns the mock again.

## Open Questions

None that block implementation. Policy version is the T1 string `2026-10-13`.
