# Design

## Context

Qingxin is a zh-CN SvelteKit 5 PWA with AppShell tabs 首页 / 内容 / 模块 / 我的. The hub still shows a disabled 游戏 tile. FloatingBeeShops (Next.js shop snapshot) is the layout reference for the games face only: compact hero, colorful category tiles, searchable product grid, card-to-detail. Its orange/sky commerce brand, Prisma, checkout, and AI companion are out of scope.

## Goals / Non-Goals

**Goals**

- Games as a first-class module whose face is a Qingxin-skinned catalog.
- One complete, actually playable 3D convenience-store shift.
- Simulation logic unit-tested without WebGL.
- Catalog and play chrome work at 390px touch and 1280px desktop, light and dark.

**Non-goals**

- Native iOS/Android, Render, Oldpeople, pricing/quotas.
- Vendoring Next.js / shop backend / payments / admin.
- Additional full games, server saves, accounts-to-play.
- Restyling the whole app purple or applying a Hallmark catalog theme.
- Bringing 组件 back into primary nav.

## Decisions

### D1 — Catalog face

**Chosen:** Reimplement the shop information architecture in Svelte (hero band, category tiles, search, featured card, 2-col phone / 3-col desktop grid, dedicated detail page, Play CTA). Covers are CSS illustrations in Qingxin tokens, not shop product photos.

**Rejected:** iframe/vendor the Next app; orange gradient-text primary; Hallmark theme deal; modal-only detail (shop modal is a pattern, but a real presentation route matches “card-to-detail then Play” and static prerender).

### D2 — Registry

**Chosen:** Typed `GAMES` array in `web/src/lib/games/catalog.ts` with `playable | coming`, category, tags, cover motif. Search/filter are pure functions.

**Rejected:** CMS, API, or remote assets for Stage 2.

### D3 — First game

**Chosen:** Chinese title **便利店经理** (English Convenient Store Manager). Grid sim (stock, shoppers, checkout, orders) plus an orthographic three-quarter Three.js view. Dynamic-import `three` on the play route. HUD for cash / time / restock / order so 390px does not rely on tiny 3D picks alone.

**Rejected:** First-person maze; server tick; gray default cubes; extra games in this change.

### D4 — Persistence

**Chosen:** Optional `localStorage` for best-day stats and last settings. Each shift starts fresh. No IndexedDB secret-like data. No API.

**Rejected:** Accounts, cloud save, leaderboards.

### D5 — 组件

**Chosen:** `/kit` stays as an unlinked developer page. Add a single 我的 row that opens it. Nav remains 首页 / 内容 / 模块 / 我的.

### D6 — Play chrome

**Chosen:** Hide phone tab bar on `/play` so the canvas can be full-bleed. In-game 返回目录, 暂停, 重新开始.

## Risks

- Playwright WebGL: assert canvas mount + HUD, not pixels of 3D.
- Static adapter: `entries` for every registry id.
- Screenshot e2e currently captures hub copy about games still coming — update those shots.
- Three.js bundle: dynamic import so unit tests never load WebGL.
