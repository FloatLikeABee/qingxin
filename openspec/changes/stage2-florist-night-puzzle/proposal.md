# Proposal

## Why

Stage 2 shipped the games catalog and 便利店经理, leaving 街角花店 and 夜窗拼图 as designed 即将到来 cards. Ge asked those two faces to become real, interesting, playable games — same catalog, guest-play, frontend-only pattern.

## What Changes

- Flip `corner-florist` and `night-puzzle` from `coming` to `playable`. Keep 潮汐呼吸, 云上散步, 记忆货架 as 即将到来.
- **街角花店:** a morning of arranging bouquets for the shop window, then customers with color/mood wants. Craft and atmosphere (stems, freshness, the window), not a dry inventory grid.
- **夜窗拼图:** restore a wind-torn night outside a window. Pieces of living night (moon, stars, city light), not a generic photo jigsaw.
- Card → detail → Play, mouse + touch, zh-CN UI, Qingxin palette. Optional localStorage for a best result. No server save, no account.
- Do not regress 便利店经理, catalog chrome, or 组件 staying off product nav.

## Capabilities

### New Capabilities

- `corner-florist`: bouquet/window/customer simulation plus play view.
- `night-puzzle`: night-shard placement simulation plus living window play view.

### Modified Capabilities

- `games-catalog`: three playable games; remaining slots stay 即将到来.

## Impact

- `web/src/lib/games/catalog.ts`, play dispatcher, florist and night modules, Vitest, Playwright catalog + play smokes and screenshots.
- No Axum/API changes.
