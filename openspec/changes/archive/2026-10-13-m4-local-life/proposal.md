# Proposal

## Why

T1 (`api/`), T2 (`web/`), M1 mood, and M10 hustle are on `main`, but 本地生活 is still the generic `[slug]` placeholder. Issue #16 and the Notion M4 card require a usable 15-minute life-circle map: nearby repair, pets, delivery, and elder-friendly services, with list/map dual view, detail (hours, call, reviews), corrections, and a publish form. CI must stay green without paid map keys.

## What Changes

- Add `services`, `reviews`, and `service_corrections` (SQLite-first, Postgres-ready) and extend `api/openapi.yaml` under `/v1/local/*`, matching M10's `/v1/hustle` slug prefix.
- Seed a demo neighborhood catalog. Authenticated list/search/sort (distance, rating), detail, reviews, publish, and correction flags. Privacy export includes the caller's reviews, submitted services, and corrections.
- Run T1 `Moderator` on review text and published service copy before insert. The no-op stub still allows; a rejecting implementation must 400 and skip the row.
- Put the map provider behind a TypeScript seam. Default is an offline SVG stub (deterministic, no network, no keys). Optional free OSM/Carto raster tiles are an adapter, never selected in CI/Playwright.
- Replace the `/modules/local` placeholder with a zh-CN, mobile-first module that reuses the T2 kit, tokens, IndexedDB cache/outbox, and typed `QingxinApi`.
- Home of the module: map + top search + bottom quick categories. Map/list toggle, service card, detail (hero + info + reviews + 导航/拨打 bar), publish form.
- Dark mode: dark stub tiles (or dark OSM tiles when that adapter is on), highlighted markers, slightly brighter card borders.
- Atmosphere stays on existing theme tokens. Do not add a second theme engine or a paid map SDK.

## Capabilities

### New Capabilities

- `local-life`: Community 15-minute services map — seed catalog, search, distance/rating sort, map/list dual view, detail, elder-friendly tags, reviews, corrections, publish, and a key-free map provider seam.

### Modified Capabilities

- `api-client`: Add typed local-life methods on `QingxinApi` and the mock.
- `app-shell`: Opening 本地生活 loads the M4 module, not the generic placeholder.
- `theming`: Dark local map uses dark tiles and highlighted markers; service cards get a slightly brighter border in dark.
- `privacy`: Export and account delete cover the caller's reviews, submitted services, and corrections.
- `offline-pwa`: Cache the services catalog and enqueue review/publish/correction writes in the existing outbox.
- `moderation`: Reviews and published service copy are checked through the injectable `Moderator` before persist.

## Impact

- New migration `api/migrations/0005_local.sql`, `api/src/local.rs`, local tests, and OpenAPI paths under `/v1/local`.
- New `web/src/lib/local/` domain modules and `/modules/local` UI; Playwright screenshots of M4 screens at 390px and 1280px in light and dark.
- No paid map keys in CI. No merge. PR body is `Refs #16`.
