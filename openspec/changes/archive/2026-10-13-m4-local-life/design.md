# Design

## Context

Issue #16, Notion card [M4 本地生活信息聚合](https://app.notion.com/p/3f8469841e1f816bb640c482b632b26d), and the user brief agree: build the module on merged T1/T2/M1/M10, reuse kit/tokens/IndexedDB/`QingxinApi`, put the map provider behind a seam with an offline/stub fallback so CI needs no paid keys, and seed demo services.

The live tree already has `api/` (Axum, SQLx, `Moderator`, privacy export) and `web/` (SvelteKit 5, kit, themes, mock client). `/modules/local` is the `[slug]` placeholder. M1 lives at `/modules/mood` + `/v1/mood`. M10 lives at `/modules/hustle` + `/v1/hustle` and is the routing template. M1 kept domain logic in `mood.rs` and screens on one route.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- A complete M4 MVP a person can use offline-first in zh-CN on a 390px phone and a 1280px desktop.
- Tests first for haversine sort, search, catalogs, moderation reject, map-provider selection, mock API, and privacy export.
- Screenshots at 390/1280 × light/dark of the M4 screens (map, list, detail).

**Non-Goals:**

- Paid map SDKs (Mapbox, 高德 key, Google Maps JS).
- Live POI crawling or a vendor Places API.
- Turn-by-turn navigation, in-app calling, or guaranteed business hours.
- A new chart library, a new component kit, or a local-only theme engine.
- Merging the PR (PO merges).

**Anti-goals:**

- Hard-coding Leaflet/Mapbox in the page so CI needs a token.
- Putting local routes under `/v1/services` as a top-level resource that future modules would collide with.
- Encrypting business phone numbers (they are public listings, not T1 user PII).

## Decisions

### D1 — Persistence

**Chosen:** Three tables matching the issue contract plus corrections — `services`, `reviews`, `service_corrections` — TEXT UUID PKs, TEXT RFC3339 timestamps. `services.created_by` is nullable (`REFERENCES users (id) ON DELETE SET NULL`) so seed rows have no owner. `reviews.user_id` and `service_corrections.user_id` cascade on delete. Extra columns the UI needs: `hours`, `phone`, `hero_key`, `latitude REAL`, `longitude REAL`, `tags_json`, `images_json`, `rating`. `rating_avg` is stored on `services` and recomputed on review insert.

**Assumptions challenged against the tree:** T1 export today lists profile/consents/devices/jobs/push/mood/hustle — M4 must extend that or a user's reviews vanish from 导出. M10 used issue table names even when generic (`applications`). Seed data is community-scoped, unlike per-user hustle rows.

**Rejected:**

1. **JSON blob column on `users`** — rejected: cannot sort by distance, export becomes opaque, T1 already avoided JSON1-as-schema.
2. **IndexedDB-only (no API tables)** — rejected: issue #16 names `services`/`reviews` and says extend the T1 contract. Client-only would skip OpenAPI and leave export empty.
3. **One `ugc_entries` table for every module** — rejected: M1/M10 already chose dedicated tables; a generic bag would fight M2/M5 later.
4. **PostGIS / SpatiaLite** — rejected: extra native deps, not Postgres-portable in this SQLite-first repo. Haversine in Rust is enough for one neighborhood.

### D2 — HTTP prefix and resources

**Chosen:** `/v1/local/services`, `/v1/local/services/{id}`, `/v1/local/services/{id}/reviews`, `/v1/local/services/{id}/corrections`. Client UUID `id` on create is idempotent (`ON CONFLICT DO NOTHING`), same as mood/hustle. All routes require `AuthUser` (Playwright already boots a mock session).

**Rejected:**

1. **`/v1/services` as a top-level collection** — rejected: too generic; M10 explicitly matched the module slug (`/v1/hustle`) so the client path is obvious and future modules do not squat `services`.
2. **`/v1/map/*`** — rejected: the capability is local life, not a generic map engine.
3. **Unauthenticated public GET** — rejected: every other module requires a token; making only M4 public would fork the mock/session story for one screen. Demo login already exists.

### D3 — Map provider seam

**Chosen:** A TypeScript `MapProvider` (`id`, `tiles(theme)`, `markerFill`, `backgroundCss`). Default adapter `stub`: SVG neighborhood (grid + 15-minute ring + projected markers), zero network. Second adapter `osm`: free Carto positron / `dark_all` raster tiles, no key. `selectMapProvider({ online, preference, webdriver })` returns `stub` if offline, `webdriver`, or unset preference. Playwright therefore never fetches tiles.

**Rejected:**

1. **Mapbox / 高德 / Google Maps JS** — rejected: paid or key-gated; issue and user brief forbid keys in CI.
2. **Leaflet always-on with OSM tiles** — rejected: adds a runtime, tile fetches flake in CI, OSM tile policy dislikes unattended bots. The seam can grow a Leaflet adapter later without rewriting screens.
3. **Server-rendered static PNG of the neighborhood** — rejected: extra binary assets, useless when the user pans, and dark/light would need two files per zoom.

### D4 — Geo math and origin

**Chosen:** Store `latitude`/`longitude` as REAL. Distance is a tested haversine in meters. Default origin is the seeded 轻心社区 `(31.230416, 121.473701)` (Jing'an, Shanghai) when the client omits `lat`/`lng`. Browser geolocation is optional progressive enhancement, never required. Equirectangular projection in the stub map is relative to the seed bounding box.

**Rejected:**

1. **Integer microdegrees** — rejected: harder to read in seeds and OpenAPI; REAL is portable.
2. **Require GPS before first paint** — rejected: permission prompts on 390px, and Playwright has no geo. The 15-minute circle is a seeded neighborhood, not the user's live GPS.
3. **Call a routing API for walking minutes** — rejected: network, keys, flaky CI. Show `distance_m` and treat the circle as a visual, not a guarantee.

### D5 — Routing and chrome

**Chosen:** Keep `/modules/local` as the only new module URL (M1/M10 pattern). Map/list is a two-way toggle, not kit `Tabs` (those are hardcoded `grid-cols-3`). Top search, bottom quick categories, selected-service card, detail as an overlay (hero + info + reviews + fixed 拨打/导航 bar), publish as a second overlay. Exclude `local` from `[slug]` `entries` like `mood` and `hustle`.

**Rejected:**

1. **Nested routes `/modules/local/[id]`** — rejected: static prerender + `[slug]` entries get messier; more jumps on a phone. M1/M10 already chose overlays.
2. **Three kit tabs 地图 / 列表 / 发布** — rejected: issue Home is "map + top search + bottom quick categories"; map/list is a dual view, not three destinations. Forcing 发布 into `Tabs` would steal a column.
3. **A second bottom-tab item "附近"** — rejected: T2 chrome is 首页 / 模块 / 组件 / 我的.
4. **Add a local-life card on app `/`** — rejected: M10 did that because issue #13 listed Home job-status on the shell. Issue #16's Home is the module home.

### D6 — Dark map and card borders

**Chosen:** Stub dark background `#0b1220` (existing `--qx-surface`), grid `--qx-line`, selected marker `--qx-primary` with a glow halo. OSM adapter uses Carto `dark_all` when that provider is actually selected. Service cards use `.local-service-card` with `ring-color-mix(primary 45%, line)` in `.dark`. No new theme engine.

**Rejected:**

1. **A fifth theme mode "map dark"** — rejected: T2 already has four modes; elder mode is a class, not a fifth palette.
2. **Invert OSM light tiles with CSS `filter: invert`** — rejected: looks sickly and breaks labels. Dark tiles exist for free.
3. **Keep default kit card rings in dark** — rejected: the issue calls out slightly brighter borders as an acceptance criterion.

### D7 — UGC and moderation

**Chosen:** Reviews and publish payloads call `state.moderator.check` on the concatenated text. `Decision::Reject` → 400 `invalid_request`, no insert. Default `NoopModerator` still allows (T1 contract). Tests inject a rejecting moderator. Correction kinds are a closed enum, not free text, so they skip the moderator. Images are optional URL strings (no blob store).

**Rejected:**

1. **Skip moderation because the stub always allows** — rejected: Notion AC says "moderation trait on UGC"; M4 is the first real call site. If we never call it, the trait stays dead.
2. **Public `/v1/moderation/check`** — rejected: T1 explicitly forbade a "safe" HTTP route.
3. **Encrypt review content** — rejected: community reviews are meant to be listed; AES would force decrypt-on-list. M1 encrypted diary notes because they were private.

### D8 — Seed data vs live POI

**Chosen:** SQL seed of ~8 listings around 轻心社区 covering 维修 / 宠物 / 配送 / 适老, including 轻心宠物医院 with elder tags and a phone. Mock client mirrors the same catalog so Playwright does not need Axum. Reviews for the pet hospital are seeded in the mock (SQL reviews need a real `user_id`).

**Rejected:**

1. **Live 高德/OSM Overpass query** — rejected: network, ToS, non-deterministic screenshots, keys.
2. **Empty catalog until users publish** — rejected: the search 宠物医院 → map → card → detail flow would be a blank screen in CI.
3. **Per-user copies of the catalog** — rejected: this is a community map, not a bookmark list. Hustle is personal; local life is shared.

## Design review (self-grill)

**Proposer:** Ship a thin but complete module: three tables, seeded neighborhood, stub map by default, kit-built screens, first real `Moderator` call site, no new platform pieces.

**Reviewer pushback:**

1. *A stub map will look like a toy.* — Correct, and that is the honest CI surface. The OSM adapter exists; it is opt-in. Screenshots stay deterministic.
2. *`services` as a table name collides with M2/M5 later.* — Same bet M10 made with `applications`. The HTTP prefix is `/v1/local`. If a later module needs a different `services`, it gets its own prefix. Renaming now would drift from the issue contract.
3. *Auth-gated list hides the map from a logged-out visitor.* — Every Qingxin module already does this; the Playwright boot script sets a session. A public GET can wait.
4. *Haversine on every list is O(n).* — The seed is <20 rows. An index on category is enough. SpatiaLite is a later problem.
5. *Calling `Moderator` on the no-op is theatre.* — Theatre that proves the injection point. The rejecting-moderator test is the contract Echo/ops can swap into.
6. *`tel:` and `geo:` are ignored on desktop.* — Same as M1 hotline: show the number and address as selectable text; the buttons still set `href`.
7. *Hero images will 404 in CI.* — `hero_key` is a closed catalog (`pet`, `repair`, `delivery`, `elder`) rendered as a CSS gradient + kit Icon. No remote bytes.
8. *Recomputing `rating_avg` races.* — SQLite tests are serialized; MVP does `AVG` after insert. Good enough.

**Revisions after grilling:**

- Default map provider is stub; OSM is opt-in and never used when `webdriver` or offline.
- HTTP lives under `/v1/local`, never `/v1/services`.
- Do not encrypt listing phones or reviews.
- Do not add kit `Tabs`; map/list is a toggle; detail/publish are overlays.
- Do not add a local-life widget on app `/`.
- `Moderator` is called on review and publish; tests inject a rejector.
- Hero is a key, not a URL.
- Privacy export and delete cascade include reviews, submitted services, corrections.
- Seeded services keep `created_by` NULL so account delete does not wipe the neighborhood.

## Risks / Trade-offs

- **[Risk] OSM tile use in production without attribution** — Mitigation: adapter always shows 地图数据 © OSM/Carto; stub needs none.
- **[Risk] IndexedDB outbox replays a review twice** — Mitigation: client UUID; server `ON CONFLICT` returns the existing row.
- **[Risk] Bright card ring fights elder-mode high-contrast lines** — Mitigation: the local-life class only mixes primary into `--qx-line`; elder tokens still apply.
- **[Risk] Clippy on a growing `routes.rs`** — Mitigation: handlers live in `local.rs`; routes only merge and extend export.
- **[Risk] Parallel M2 finance PR also edits `openapi.yaml` / `types.ts` / `mock.ts` / `[slug]/+page.ts`** — Mitigation: append-only OpenAPI; one-line slug filter; keep shared hunks tiny.

## Migration Plan

1. Land OpenSpec artifacts, then tests, then implementation on `cursor/m4-local-life-aa89`.
2. A later HTTP `QingxinApi` implements the same methods from OpenAPI.
3. A later Leaflet/高德 adapter implements `MapProvider` without changing screens.
4. Rollback: revert the branch; drop `0005_local.sql` on empty local DBs.

## Open Questions

None that block M4. Live GPS walking minutes, object-stored photos, and a paid map adapter wait for later polish.
