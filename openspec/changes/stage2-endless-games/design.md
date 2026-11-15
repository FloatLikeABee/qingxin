# Design

## Decisions

### D1 — Names and ids

**Chosen:** 晴空出击 / `sky-sortie` (飞行); 窗前庭园 / `window-garden` (经营). Aliases redirect.

**Rejected:** Keep old titles (misleading). Hide old URLs without redirect (breaks bookmarks).

### D2 — Shooter tech

**Chosen:** Canvas 2D + pure TS sim, fixed 16ms tick, elapsed-ms cap. Auto-fire, 3 lives, invuln, distinct enemy scores, wreck obstacles, rotating bosses.

**Rejected:** Three.js (already used by the store; extra WebGL not needed). Generic sprite jigsaw leftovers.

### D3 — Garden tech

**Chosen:** DOM/SVG plants keyed by unique `form`. 12 beds. Versioned localStorage with corrupt → fresh + recovered. 空园补给 deadlock escape.

**Rejected:** Shared one-shape plant with 40 labels. Server save.

### D4 — Tests vs cheats

**Chosen:** Vitest owns full combat/garden progression with seeds. Playwright steers the real UI. No debug HUD.

## Risks

- First boss too slow for e2e: spawn at wave 3 with ~8s waves.
- Garden ripe too slow: `stageTicks` ~12 at 10Hz with needs met.
- 390px clutter: tools in a bottom sheet, playfield first.
