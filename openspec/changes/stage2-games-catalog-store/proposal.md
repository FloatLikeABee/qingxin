# Proposal

## Why

Stage 1 left 游戏 as a disabled 「即将到来」 tile. Stage 2 turns Games into a real 模块 with a shop-catalog face (adapted from FloatingBeeShops layout, not its commerce stack) and ships the first playable game: Convenient Store Manager / 便利店经理. Qingxin stays a SvelteKit + Axum web app. Content, Secrets, privacy, and the 首页 / 内容 / 模块 / 我的 chrome stay.

## What Changes

- Enable the Games module: listed in 模块, own routes, searchable catalog, card → detail → Play.
- Adapt the FloatingBeeShops home face (hero, category tiles, searchable card grid, featured item, dark mode, tight gutters, hover lift) into Qingxin blue / coral / teal / gold. Do not import orange-primary shop brand, Next.js, checkout, or shop copy.
- Extensible in-memory game registry. Only 便利店经理 is playable; other slots are designed 「即将到来」 cards.
- Keep 组件 off product chrome. If `/kit` remains, link it only from 我的 / settings.
- First game: pure frontend Three.js convenience-store shift (shoppers, shelves, storeroom, light economy, day result). Mouse + touch. Pause / restart. Optional localStorage for best day. No server save, no accounts required to play.
- No native apps, pricing, extra full games, API changes, or Stage 3.

## Capabilities

### New Capabilities

- `games-catalog`: Extensible registry, search/filter, catalog/detail/play routes, Qingxin-skinned shop face.
- `store-manager`: Deterministic store simulation plus Three.js 便利店经理 play view.

### Modified Capabilities

- `app-shell`: Games is a real module. 组件 stays out of primary nav; kit may appear only under 我的.

## Impact

- `web/src/lib/games/*`, `/modules/games`, `/modules/games/[id]`, `/modules/games/[id]/play`.
- Hub tile, settings kit link, Playwright catalog + play smoke, Vitest for registry/filter/sim.
- `three` as a web dependency. No Axum/OpenAPI changes.
