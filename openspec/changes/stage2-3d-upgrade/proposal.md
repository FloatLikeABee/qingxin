# Proposal

## Why

Ge asked for better, more realistic Window Garden and Convenient Store UI in the existing Three.js style, with more plants, travelling bugs, and easier operations. They approved the 3D upgrade design.

## What Changes

- 窗前庭园: Three.js window garden, ≥60 morphologically distinct plants, prune/repot, arrive/visit/leave bugs, pictured seed browser, schema 2 with schema 1 migration.
- 便利店经理: visual Three.js upgrade (packaging, fridge, checkout, shopper actions, lighting, HUD). Simulation/scoring unchanged.
- 晴空出击 unchanged.

## Capabilities

### Modified Capabilities

- `window-garden`: 60 plants, Three.js play, prune/repot, travelling bugs, schema 2.
- `convenient-store`: richer scene and HUD; same sim.
- `games-catalog`: garden copy says 六十多种.

## Impact

- `web/src/lib/games/garden/**`, `store/render.ts`, `store/StorePlay.svelte`, catalog, Vitest, Playwright. No Axum/API.
