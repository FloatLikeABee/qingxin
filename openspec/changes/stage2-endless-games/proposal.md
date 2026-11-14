# Proposal

## Why

Ge tested the florist and night-puzzle first versions and said they are not fun. They approved a replacement: an endless 2D jet shooter and an endless garden with 40+ distinct plants.

## What Changes

- Catalog: playable ids become `convenient-store`, `window-garden`, `sky-sortie`. Titles 窗前庭园 / 晴空出击. Add category 飞行. Old `corner-florist` and `night-puzzle` routes redirect.
- Remove florist bouquet sim and night-shard puzzle from play routes.
- New frontend-only games, guest, optional localStorage, mouse+touch, zh-CN, Qingxin palette.
- Keep 便利店经理 and the three remaining 即将到来 placeholders.

## Capabilities

### New Capabilities

- `sky-sortie`: endless 2D shooter simulation and play view.
- `window-garden`: endless garden simulation, 40+ plants, bugs, save schema.

### Modified Capabilities

- `games-catalog`: new titles, category 飞行, redirects from old ids.

### Removed Capabilities

- Playable florist/night-puzzle mechanics (replaced; old URLs redirect).

## Impact

- `web/src/lib/games/catalog.ts`, GameCover, play dispatcher, new `shooter/` and `garden/` modules, Vitest, Playwright. No Axum/API.
