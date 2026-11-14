# 窗前庭园 Three.js Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User forbade spawned reviewer agents — execute inline.

**Goal:** Turn 窗前庭园 into a Three.js window-sill garden with ≥60 morphologically distinct plants, arrive/visit/leave bugs, prune/repot rules, pictured seed browser, and schema-2 migration from c358d29 saves.

**Architecture:** Keep `plants.ts` / `sim.ts` / `persist.ts` as the unit-tested core. Add `morph.ts` (pure signatures + family list). Add `render.ts` (Three.js, dynamic import like the store). Rewrite `GardenPlay.svelte` so the canvas dominates and HUD/actions are contextual. DOM bed list is the accessible twin and WebGL fallback.

**Tech Stack:** SvelteKit 5, TypeScript, existing `three`, Vitest, Playwright. No new dependencies.

## Global Constraints

- Same PR 36 branch `cursor/stage2-games-catalog-e526`; do not merge/deploy.
- Do not edit `web/src/lib/games/shooter/**`.
- Qingxin zh-CN, `--qx-*` chrome, paler sky / blue / coral / teal / gold.
- Guest, localStorage only, schema 2 accepts schema 1 without dropping plants.
- Pause on `document.hidden`; dispose WebGL; cap bugs at 8.
- Touch targets ≥ 44px; no hover-only tooltips; no cheat controls in normal UI.
- Biology disclaimer stays. 空园补给 stays.

---

### Task 1: 60+ unique plants with morphology

**Files:**
- Modify: `web/src/lib/games/garden/plants.ts`
- Modify: `web/src/lib/games/garden/plants.spec.ts`
- Create: `web/src/lib/games/garden/morph.ts`

**Interfaces:**
- Produces: `PlantDef` with `id`, `name`, `morph: Morph`, needs, economy. `morphKey(morph): string`. `MORPH_FAMILIES` list of 10 families.

- [ ] **Step 1: Write the failing test**

```ts
import { MORPH_FAMILIES, morphKey } from './morph';
import { PLANTS } from './plants';

it('has at least 60 unique plants with unique morphology', () => {
  expect(PLANTS.length).toBeGreaterThanOrEqual(60);
  expect(new Set(PLANTS.map((p) => p.id)).size).toBe(PLANTS.length);
  expect(new Set(PLANTS.map((p) => p.name)).size).toBe(PLANTS.length);
  expect(new Set(PLANTS.map((p) => morphKey(p.morph))).size).toBe(PLANTS.length);
  for (const family of MORPH_FAMILIES) {
    expect(PLANTS.some((p) => p.morph.family === family)).toBe(true);
  }
  expect(PLANTS.some((p) => p.id === 'tomato')).toBe(true);
  expect(PLANTS.some((p) => p.id === 'bokchoy')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run src/lib/games/garden/plants.spec.ts`
Expected: FAIL (length 42, morph missing)

- [ ] **Step 3: Write morph.ts + expand plants.ts to ≥60, keep original 42 ids**

Keep `plantById` / `unlockedPlants`. Add 22 new species (小白菜, 羽衣甘蓝, 芹菜, 香芹, 百里香, 鼠尾草, 香菜, 雏菊, 郁金香, 扶桑, 万寿菊, 牵牛, 豌豆, 豇豆, 西葫芦, 蓝莓, 萝卜, 梨, 桃, 纸莎, 玉露, 柿子). Each `morph` unique.

- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: Commit** `test(garden): require 60 unique morphologies`

---

### Task 2: Bug travel, prune, repot, time-step

**Files:**
- Modify: `web/src/lib/games/garden/sim.ts`
- Modify: `web/src/lib/games/garden/sim.spec.ts`

**Interfaces:**
- Consumes: `plantById`
- Produces: `BugKind` includes `butterfly` | `caterpillar`; `Bug.phase` `'arrive' | 'visit' | 'leave'`; `garden.bugs`; `pruneBed`; `repotBed`; `stepGarden(garden, dt, acc)`; `Bed.potSize`, `pruned`, `lastPrune`.

- [ ] **Step 1: Write failing tests** for:
  - pests arrive → visit → damage → leave
  - bees/butterflies speed growth; mistaken catch scolds
  - ladybugs remove aphids
  - prune on leaf restores health; prune on seed refuses; double-prune delays
  - repot costs 6, potSize 2, extra harvest; second repot refuses
  - `stepGarden` caps dt at 0.05 and ticks at 0.1s
  - bugs.length never exceeds 8
  - existing plant/water/harvest/deadlock tests still pass (update Bug shape in pest test)

- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement sim changes; spawn rate ~0.012/tick so Playwright sees a visit**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit** `feat(garden): prune, repot, travelling bugs`

---

### Task 3: Schema 2 + c358d29 migration

**Files:**
- Modify: `web/src/lib/games/garden/persist.ts`
- Modify: `web/src/lib/games/garden/persist.spec.ts`

- [ ] **Step 1: Failing test** — a schema-1 payload with a planted tomato, coins 40, harvests 3 loads with `recovered: false`, tomato still in bed 2, `potSize === 1`.
- [ ] **Step 2: Run — fail** (schema !== 1 rejects)
- [ ] **Step 3: Accept schema 1 and 2; default new fields; still reject corrupt JSON**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat(garden): migrate schema 1 saves`

---

### Task 4: Three.js scene + play UI

**Files:**
- Create: `web/src/lib/games/garden/render.ts`
- Modify: `web/src/lib/games/garden/GardenPlay.svelte`
- Modify: `web/src/lib/games/garden/PlantView.svelte` (seed-browser thumbs + fallback)
- Modify: `web/src/lib/games/catalog.ts` (六十多种)

**Interfaces:**
- Consumes: `GardenState`, `PLANTS`
- Produces: `mountGardenScene(canvas)` → `{ sync, render, resize, dispose, pick }` like the store.

- [ ] **Step 1: No unit test for WebGL; sim coverage is Task 2. Playwright in Task 5.**
- [ ] **Step 2: Build window, sill, 12 pots, family-specific plant meshes, flying bugs, selection ring, quality fallback `null`.**
- [ ] **Step 3: GardenPlay — canvas dominates; large contextual actions; pictured filterable seed sheet; DOM bed list `data-bed`; keyboard; hidden-tab pause; `__qingxinGardenTest.seedDemo` only if `__qingxinE2E`.**
- [ ] **Step 4: `npm run check`**
- [ ] **Step 5: Commit** `feat(garden): Three.js window garden play view`

---

### Task 5: Playwright gameplay

**Files:**
- Modify: `web/e2e/games.e2e.ts`
- Modify: `web/e2e/screenshots.e2e.ts`
- Modify: `web/e2e/endless-play.e2e.ts`

- [ ] Assert canvas `data-ready`, plant/care/prune/repot/harvest, insect visit, several mature species via seedDemo, save reload.
- [ ] Screenshots 390/1280 light/dark; recordings of active play.
- [ ] Keep shooter tests unchanged.

---

### Spec coverage

60 plants, morph families, bugs travel, prune/repot, schema 1 migrate, Three.js, contextual buttons, seed browser, a11y DOM, WebGL fail text, pause hidden, shooter untouched — all tasked.
