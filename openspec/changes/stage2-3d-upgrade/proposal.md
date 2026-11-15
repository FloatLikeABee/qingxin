# Proposal

## Why

Ge asked for better, more realistic Window Garden and Convenient Store UI in the existing Three.js style, with more plants, travelling bugs, and easier operations. They approved the 3D upgrade design.

## What Changes

- 窗前庭园: Three.js window garden of ten common vegetables, prune/repot, arrive/visit/leave bugs, pictured seed browser, scene pot picking, glassy dock, schema 3 with schema 1/2 vegetable remapping.
- 便利店经理: visual Three.js upgrade (packaging, fridge, checkout, shopper actions, lighting, glassy HUD). Simulation/scoring unchanged.
- 晴空出击 unchanged.

## Capabilities

### Modified Capabilities

- `window-garden`: ten vegetables, Three.js play, prune/repot, travelling bugs, schema 3.
- `convenient-store`: richer scene and glassy HUD; same sim.
- `games-catalog`: garden copy names the ten vegetables.

## Impact

- `web/src/lib/games/garden/**`, `store/render.ts`, `store/StorePlay.svelte`, catalog, Vitest, Playwright. No Axum/API.
