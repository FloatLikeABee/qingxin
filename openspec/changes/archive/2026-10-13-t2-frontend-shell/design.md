# Design

## Context

See proposal.md — Why. The repo is empty except for a root README. T2 must land a complete frontend shell in `web/` that T1 (Forge, Rust/Axum) can later plug into. The issue contract and design.txt excerpts (1.3–1.5) are the constraints: SvelteKit + strict TS + Tailwind, CSS-variable theming with class strategy, IndexedDB + silent sync, zh-CN, and a custom kit rather than shipping a third-party mobile library as the source of truth.

Superpowers self-grill (required): at least three alternatives were considered and rejected before locking the approach below.

## Goals / Non-Goals

**Goals:**

- Keep theme resolution, offline cache, and the API client as pure, unit-tested modules.
- Apply the stored theme before first paint.
- Make the kit the only UI primitive layer screens use.
- Keep the mock API swappable by changing one factory.

**Non-Goals:**

- Real Aliyun/Tencent content-security calls, AES-at-rest of government IDs, or HTTPS termination (hosting concern).
- Full module business logic (diaries, ledgers, job boards). Placeholders only.
- Multi-language i18n beyond zh-CN chrome.
- Merging the PR (PO merges).

## Decisions

### D1 — App framework

**Chosen:** SvelteKit 2 + Svelte 5 + TypeScript strict + Vite, static adapter with an offline fallback.

**Rejected:**

1. **Next.js App Router** — rejected because issue #1 mandates SvelteKit at `web/`. A React shell would fail the contract even if PWA support is mature.
2. **Vite + vanilla Svelte SPA** — rejected because we need file-based routes (`/kit`, `/settings`, `/login`, module pages) and `svelte-check` as a first-class CI gate.
3. **Nuxt / Vue** — rejected for the same contract reason; zh-CN ecosystem familiarity is not worth leaving the specified stack.

### D2 — Theme engine

**Chosen:** CSS custom properties on `:root` / `.dark`, Tailwind `darkMode: 'class'`, plus a blocking inline script in `app.html` that reads `qingxin.theme` from `localStorage` and sets `class="dark"` before paint. Night-only uses a local-time window 19:00–07:00 so unit tests can inject a clock.

**Rejected:**

1. **`media` strategy (`prefers-color-scheme` only)** — rejected because it cannot express explicit 浅色 while the OS is dark, nor 仅夜间开启.
2. **CSS-in-JS / runtime theme providers (e.g. ThemeProvider that paints after hydrate)** — rejected because first paint would flash the wrong palette, violating spec 1.3.
3. **Sunset via geolocation** — rejected: extra permission, flaky tests, and a privacy-consent conflict with 最小必要原则. A fixed night window is deterministic and documented.

### D3 — Offline stack

**Chosen:** `@vite-pwa/sveltekit` (Workbox generateSW) for the app-shell + navigate fallback, plus a thin IndexedDB wrapper (no Dexie) with an outbox store. Tests use `fake-indexeddb`.

**Rejected:**

1. **Dexie as the public API** — rejected: heavier dependency and harder to swap the storage backend in unit tests. A small typed wrapper is enough for key/value + queue.
2. **localStorage-only cache** — rejected: quota and no structured outbox; spec 1.4 requires IndexedDB.
3. **Hand-rolled service worker without Workbox** — rejected: cache versioning and navigateFallback are easy to get wrong; vite-pwa is the maintained SvelteKit path.

### D4 — API boundary

**Chosen:** `QingxinApi` TypeScript interface + `MockQingxinApi` default. A factory `getApi()` returns the mock until T1 OpenAPI lands.

**Rejected:**

1. **Call `fetch` from each page** — rejected: every screen would rewrite when Forge ships.
2. **Generate a client from a guessed OpenAPI file** — rejected: T1 has not published a spec; a guessed schema would rot.
3. **GraphQL layer** — rejected: T1 is described as Axum/OpenAPI, not GraphQL.

### D5 — Design-system delivery

**Chosen:** First-party Svelte 5 components using the token CSS variables. `/kit` is the living catalog. Vant/ECharts are not runtime dependencies; the kit exposes chart color tokens so a later chart library can adopt them.

**Rejected:**

1. **Ship Vant as the kit** — rejected: Vant is Vue; this is Svelte. Spec 1.3 only says third-party widgets must receive dark tokens if used.
2. **shadcn-svelte wholesale** — rejected: English-first, not tuned to 44px / zh-CN density; we would still restyle every primitive.
3. **Unstyled headless-only (bits-ui) without a catalog** — rejected: `/kit` is an acceptance criterion; we need visible, branded primitives.

### D6 — Navigation

**Chosen:** Shared `AppShell`: bottom tabs below the `md` breakpoint, left sidebar at `md+`. Tabs: 首页, 模块, 组件, 我的. Module hub is a dedicated route with ten cards.

**Rejected:**

1. **Hamburger-only nav on all sizes** — rejected: spec 1.4 puts core actions in the lower half on phones.
2. **Ten bottom tabs** — rejected: exceeds thumb-reach and Material/iOS tab limits; hub pattern matches “减少跳转”.
3. **Separate mobile and desktop apps** — rejected: one SvelteKit codebase with responsive chrome.

## Risks / Trade-offs

- **[Risk] Path-filtered CI ignores non-`web/**` PRs** → Mitigation: workflow matches the issue literally (`web/**`). This PR includes `web/**` so the first run is green.
- **[Risk] Service worker caching stale shells in preview** → Mitigation: enable SW in production builds; document hard-reload; bump `cacheId` with the app version.
- **[Risk] Night-only surprises travelers** → Mitigation: window is documented in settings copy; user can switch to 浅色/深色.
- **[Risk] Mock API diverges from T1** → Mitigation: keep the interface small and documented; no page imports the mock class directly.
- **[Risk] `fake-indexeddb` ≠ Safari IDB** → Mitigation: wrapper stays small; Playwright smoke still hits Chromium.

## Migration Plan

1. Land `web/` and `.github/workflows/web.yml` on a feature branch.
2. When T1 publishes OpenAPI, add `HttpQingxinApi` implementing the same interface and switch `getApi()`.
3. Rollback: revert the branch; PWA caches expire on `cacheId` change.

## Open Questions

None that block implementation. Content-security vendor wiring waits for a later backend task.
