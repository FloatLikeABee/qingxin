# 烹饪 Cooking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the t278u/t280u-approved **烹饪** kitchen sandbox (`home-kitchen`) as a 3D counter: raw bowls → pan (cap 12) → heat/stir → plate (cap 8), no orders or fail timers; plus a shelf HUD cap-copy correction so compact haunt/pause still shows **两** not **四**.

**Architecture:** Headless `kitchen/sim.ts` owns pieces, heat, doneness, plating. `persist.ts` writes only `qingxin.games.home-kitchen` schema 1. `render.ts` is one Three.js counter (bowls, pan, flame, steam, plates). `KitchenPlay.svelte` is pointer-drag gameplay, not a menu of dish names. Catalog title is **烹饪**, never 灶台. Cover motif is a procedural **wok** (pan + flame), not the surgery lamp.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright. Pointer Events + `touch-action: none` on the stage (not HTML5 DnD). Heat chips `min 44px` on `pointer: coarse` (`CONTROL_MIN_PX`). Safe-area on HUD. `text-wrap: pretty` on dock copy.

## Global Constraints

- Base `47211a92` (shelf polish, PR #52) which already contains cloud left/right `0394185`. Branch `cursor/home-kitchen-4e4e`, stack on PR **#52**, base `cursor/shelf-full-haunts-4e4e`. Do not rewrite the Mac-bound shelf pin.
- Catalog id `home-kitchen`, title **烹饪**, englishTitle **Cooking**, category **经营**, tags `厨房, 炒菜, 烹饪`, playCta **开始做饭**, play `/modules/games/home-kitchen/play`.
- Save key `qingxin.games.home-kitchen` schema **1**. Never read/write sibling `qingxin.games.*` or `qingxin.theme`.
- Pan cap **12** → notice **锅满了**, piece stays in the bowl. Plate cap **8** → notice **盘子满了**, piece stays in the pan. Not a fail, no buzzer.
- Heat **文火 / 武火 / 关火**. Stir = drag inside the pan. Doneness `0…1` from heat×time. Visual from doneness, **not** from the dish label.
- Bowls: 菜叶, 肉片, 蛋, 面团, 豆腐, 虾. No paid photos.
- Audio **锅气** off until opt-in. No orders, countdown, customers, Hospital, annual-report code, stock sim.
- Guest/offline. Natural desktop + 390. Pause stops doneness. Reload restores pan/plated/settings.

## File map

- Modify: `web/src/lib/games/shelf/ShelfPlay.svelte`, `web/e2e/memory-shelf.e2e.ts` — live compact cap copy during haunt/pause
- Create: `web/src/lib/games/kitchen/sim.ts` + `sim.spec.ts`
- Create: `web/src/lib/games/kitchen/persist.ts` + `persist.spec.ts`
- Create: `web/src/lib/games/kitchen/render.ts`, `audio.ts`, `KitchenPlay.svelte`
- Modify: `web/src/lib/games/catalog.ts`, `catalog.spec.ts`, `filter.spec.ts`, `GameCover.svelte`
- Modify: `web/src/routes/modules/games/[id]/play/+page.svelte`
- Create: `web/e2e/home-kitchen.e2e.ts`
- Modify: `web/e2e/games.e2e.ts` — search 烹饪, open play

## Self-review vs spec

| Spec | Plan |
|---|---|
| Title 烹饪 not 灶台; id home-kitchen | catalog + GameCover wok |
| 6 raw bowls, drag into pan | `pickBowl` / `dropOnPan`; hit zones bowl/pan |
| Pan 12, 锅满了, stays in bowl | `addToPan` rejects at 12 |
| 文火/武火/关火, stir drag | `setHeat`, `stirPan`; 44px chips |
| Doneness 0–1 heat×time; color≠label | `stepKitchen`, `pieceColor(kind, doneness)` |
| Plate drag, flavor label, 8 dishes, 洗碗 | `dropOnPlate`, `dishLabel`, `washPlates` |
| Schema 1, sibling keys | persist tests with fake Storage |
| WebGL fail 2D chips | KitchenPlay `sceneFailed` grid |
| Low-detail 6 kinds (already 6), no shadows, DPR 1 on 390 | `applyDetail` |
| 年报/潮汐/店/上班/手术 boot | e2e plus **cloud signed-direction**, cargo, shelf |
| Shelf compact HUD 两 during haunt | Task 0 header chip + `data-cap-copy` |

No placeholders. Types below are the contract for every later task.

## Types (locked)

```ts
export const PAN_CAP = 12;
export const PLATE_CAP = 8;
export const FOOD_KINDS = ['veg', 'meat', 'egg', 'dough', 'tofu', 'shrimp'] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];
export type Heat = 'off' | 'low' | 'high';
export type Held =
	| { source: 'bowl'; kind: FoodKind }
	| { source: 'pan'; id: string }
	| null;
export type PanPiece = {
	id: string;
	kind: FoodKind;
	doneness: number;
	x: number;
	z: number;
};
export type PlatedDish = {
	id: string;
	kinds: FoodKind[];
	doneness: number;
	label: string;
};
export type KitchenWorld = {
	pan: PanPiece[];
	plated: PlatedDish[];
	heat: Heat;
	held: Held;
	notice: string;
	paused: boolean;
	lowDetail: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
	t: number;
	nextId: number;
};
```

---

### Task 0: Compact haunt HUD still says 两

**Files:** `ShelfPlay.svelte`, `memory-shelf.e2e.ts`

Parent read the 390 haunt screenshot and reported **最多四只鬼** while compact cap is 2. `hauntCapHint(world)` is already cap-based; make the live cap unmistakable in the **header** (visible while paused/haunting) and stamp `data-cap-copy` on `.need`. E2e must assert **after** apology pause, not only at boot.

- [ ] Header `<li><b>最多{hauntCapWord(world)}只</b><span>同时</span></li>`
- [ ] `.need` gets `data-cap-copy={hauntCapWord(world)}`
- [ ] 390 haunt pause: `data-cap-copy` is `两`; `.need` matches `/最多两只鬼/`; `.need` has no `四只鬼`
- [ ] Commit with Cooking work (same checkpoint; do not change Mac pin `47211a92` history)

---

### Task 1: Sim — pan, heat, doneness, plate

**Files:** Create `web/src/lib/games/kitchen/sim.ts`, `sim.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
it('rejects a 13th pan piece with 锅满了 and leaves the bowl', () => {
  const w = createKitchen();
  for (let i = 0; i < 12; i++) {
    pickBowl(w, 'veg');
    expect(dropOnPan(w, 0, 0)).toBe(true);
  }
  pickBowl(w, 'meat');
  expect(dropOnPan(w, 0, 0)).toBe(false);
  expect(w.pan).toHaveLength(12);
  expect(w.notice).toMatch(/锅满了/);
  expect(w.held).toBeNull();
});

it('武火 doneness rises faster than 文火; off does not cook', () => {
  const high = createKitchen();
  const low = createKitchen();
  const off = createKitchen();
  pickBowl(high, 'egg'); dropOnPan(high, 0, 0); setHeat(high, 'high');
  pickBowl(low, 'egg'); dropOnPan(low, 0, 0); setHeat(low, 'low');
  pickBowl(off, 'egg'); dropOnPan(off, 0, 0); setHeat(off, 'off');
  stepKitchen(high, 2000); stepKitchen(low, 2000); stepKitchen(off, 2000);
  expect(high.pan[0]!.doneness).toBeGreaterThan(low.pan[0]!.doneness);
  expect(low.pan[0]!.doneness).toBeGreaterThan(0);
  expect(off.pan[0]!.doneness).toBe(0);
  expect(pieceColor('egg', 0.9)).not.toEqual(pieceColor('egg', 0));
  expect(pieceColor('egg', 0.5)).toEqual(pieceColor('egg', 0.5)); // label-independent
});

it('plates up to 8 dishes then 盘子满了; 洗碗 clears; restart empties pan only', () => {
  const w = createKitchen();
  for (let i = 0; i < 8; i++) {
    pickBowl(w, 'veg'); dropOnPan(w, 0, 0);
    pickPanPiece(w, w.pan[0]!.id);
    expect(dropOnPlate(w, i)).toBe(true);
  }
  pickBowl(w, 'egg'); dropOnPan(w, 0, 0);
  pickPanPiece(w, w.pan[0]!.id);
  expect(dropOnPlate(w, 0)).toBe(false);
  expect(w.notice).toMatch(/盘子满了/);
  expect(w.pan).toHaveLength(1);
  washPlates(w);
  expect(w.plated).toHaveLength(0);
  setHeat(w, 'high');
  w.audioWanted = true;
  restartKitchen(w);
  expect(w.pan).toHaveLength(0);
  expect(w.heat).toBe('off');
  expect(w.audioWanted).toBe(true);
});
```

Also: pause skips doneness; stir moves x/z; `dishLabel(['egg'])` is 煎蛋; `dishLabel(['veg','meat'])` is flavor not empty; color ignores a fake label string (function has no label arg).

- [ ] **Step 2: RED** `cd web && npx vitest --run src/lib/games/kitchen/sim.spec.ts`
- [ ] **Step 3: Implement** `createKitchen`, `pickBowl`, `pickPanPiece`, `dropOnPan`, `dropOnPlate`, `setHeat`, `stirPan`, `stepKitchen`, `washPlates`, `restartKitchen`, `pieceColor`, `dishLabel`, `maxDoneness`. Rates: low `0.000055` / ms, high `0.00018` / ms, off 0. Clamp doneness 0–1.
- [ ] **Step 4: GREEN**
- [ ] **Step 5: Commit** `feat(kitchen): pan cap, heat doneness, and plating sim`

---

### Task 2: Persist schema 1

**Files:** Create `persist.ts`, `persist.spec.ts`

- [ ] Key `qingxin.games.home-kitchen`, `KITCHEN_SCHEMA = 1`
- [ ] Round-trip pan ids/kinds/doneness/x/z, plated labels, settings
- [ ] Sibling cargo/cloud/operation/memory-shelf/annual-report/tide-breath/convenient-store/story-clinic and `qingxin.theme` untouched
- [ ] Foreign/corrupt → empty kitchen, `recovered`, notice 厨房重新收拾好了
- [ ] Commit `feat(kitchen): schema 1 home-kitchen save`

---

### Task 3: Catalog 烹饪 + wok cover

**Files:** `catalog.ts`, `catalog.spec.ts`, `filter.spec.ts`, `GameCover.svelte`, `play/+page.svelte`

- [ ] `CoverMotif` adds `'wok'`. Card: title 烹饪, englishTitle Cooking, not 灶台. Search 烹饪 hits it. Category 经营.
- [ ] Cover: pan ellipse + flame, no OR lamp / wound.
- [ ] Play switch `home-kitchen` → `KitchenPlay`
- [ ] Commit `feat(kitchen): catalog 烹饪 with wok cover`

---

### Task 4: 3D counter + HUD + 2D fallback

**Files:** `render.ts`, `audio.ts`, `KitchenPlay.svelte`

Pointer: `pointerdown`/`move`/`up` on stage, `touch-action: none`. Hit `bowl` / `pan` / `piece` / `plate`. Dataset: `data-ready`, `data-pan`, `data-plated`, `data-heat`, `data-doneness` (max in pan), `data-held`, `data-steam` (1 when heat≠off and some doneness>0.2). Bowls project `data-bx-veg` etc. Pan `data-panx/pany`. Plate 0 `data-plx0`.

Heat chips 文火/武火/关火, `aria-pressed`, coarse 44px. 锅气 opt-in. 洗碗, 重新开始, 暂停, 低细腻. Reduced-motion: no steam wobble, color still shifts. WebGL fail: 2D chips + pan rectangle.

- [ ] Commit `feat(kitchen): 3D counter drag, heat, steam, plates`

---

### Task 5: Playwright + screenshots + STOP

**File:** `web/e2e/home-kitchen.e2e.ts` (+ games.e2e search)

Natural pointer only. No `evaluate` pan writes.

- Catalog 烹饪 / Cooking / 开始做饭 / not 灶台; play `home-kitchen`
- 1280: drag 菜叶 into pan, `data-pan>=1`, set 武火, `data-doneness` rises, no timer UI; steam; drag onto plate; `data-plated>=1`; dualShot raw / cooking / plated
- Overflow: 12 in pan, 13th → 锅满了
- 390: drag, heat chip ≥44px, dual gameplay
- Reload keeps pan/plated; pause freezes doneness
- Siblings: cargo canvas ready; **cloud** ArrowRight at yaw 0 moves along screen-right (`alongScreenRight` > 0.4); operation `[data-play=operation]`; memory-shelf `data-ready=1`

Inspect PNGs before claim. `svelte-check`; full vitest; `CI=1` kitchen e2e. Push. ManagePullRequest stack_on **52**. STOP. No Hospital / annual-report / stock code.

---

### Task 6: Parent visual polish (390 clip + recognizable food)

Parent read 1280 cooking + 390 plated: core loop good, but 390 eight-plate row clips left/right (plated food half cut off). Six raw foods look like identical blobs.

- [x] Compact layout keyed off **canvas width < 500**, not aspect (stage aspect on 390 is ~0.75 and was using the wide row).
- [x] Narrow: bowls 3×2, plates 4×2, camera more top-down so all six bowls and eight plates sit inside the stage with pad, not under HUD/dock.
- [x] Procedural shapes: veg leaves, meat slabs, egg+yolk, dough lump, tofu cube, curved shrimp. Color still follows doneness. Labels on bowls (`菜叶`…) and plates (`盘n` / dish name). Held chip.
- [x] Unit: compact positions inside ±1.05; six distinct `FOOD_SHAPE`s.
- [x] E2e: `data-inbox=1` on 1280 and 390; bounding boxes for **all** 6 bowls and **all** 8 plates; 390 plates onto every slot; stir drag; fresh raw/cooking/plated shots **read**.
- [x] No orders/timers. No Hospital / annual-report / stock. Do not subscribe to CI.
