# Stage 2 Games Catalog + 便利店经理

> **For agentic workers:** implement against `openspec/changes/stage2-games-catalog-store/`. Two commits on `cursor/stage2-games-catalog-e526`. No extra cloud agents.

**Goal:** Turn 游戏 into a real Qingxin module with a FloatingBeeShops-style catalog, then ship Convenient Store Manager as the only full game.

**Architecture:** In-memory `GAMES` registry + pure filter; Svelte catalog/detail/play routes inside AppShell. Store sim is a tick function in TypeScript; Three.js is dynamically imported only on the play route.

**Tech Stack:** SvelteKit 5, Tailwind 4, Vitest, Playwright, `three`.

## Global Constraints

- Web-only SvelteKit + Axum. No native apps, Oldpeople, pricing, API changes.
- Qingxin palette `#3B82F6` / `#60A5FA`, pale sky, coral/teal/gold. No shop orange primary.
- Nav stays 首页 / 内容 / 模块 / 我的. 组件 only from 我的.
- zh-CN UI. 390 and 1280, light and dark.
- One playable game this PR.

## Files

- `web/src/lib/games/catalog.ts`, `filter.ts` — registry
- `web/src/lib/games/store/sim.ts` — economy / shoppers
- `web/src/lib/games/*.svelte` — catalog chrome
- `web/src/routes/modules/games/**` — catalog, detail, play
- `web/src/lib/modules.ts`, `settings/+page.svelte`, `AppShell.svelte`

## Verify

`npm test`, `npm run check`, `npx playwright test e2e/games.e2e.ts e2e/screenshots.e2e.ts` (games tests).
