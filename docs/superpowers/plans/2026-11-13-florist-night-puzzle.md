# 街角花店 + 夜窗拼图 Implementation Plan

> **For agentic workers:** implement against `openspec/changes/stage2-florist-night-puzzle/`. Same branch `cursor/stage2-games-catalog-e526`. Update PR 36. No extra agents.

**Goal:** Two playable catalog games with testable sims and Qingxin-crafted play views.

**Files**

- `web/src/lib/games/catalog.ts` — playable flags, `playCta`
- `web/src/lib/games/florist/{stems,sim,persist,FloristPlay}.ts(x svelte)`
- `web/src/lib/games/night/{scene,sim,persist,NightPlay}.svelte`
- `web/src/routes/modules/games/[id]/+page.svelte` — per-game CTA
- `web/src/routes/modules/games/[id]/play/+page.svelte` — dispatch
- e2e + screenshots

**Verify:** `npm test`, `npm run check`, Playwright games + new screenshot cases.
