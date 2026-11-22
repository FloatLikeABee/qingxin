# 记忆货架 48 cells / 4 concurrent ghosts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pack the walnut case to **48 cells** (~36 books + 12 props) and allow up to **four independent funny ghosts**, each bound to its own book, crying **对不起！** and retreating into **that same book**, with auto-refill and no one-ghost-per-round lock.

**Architecture:** Keep one 48-item catalog in `world.items` (ids `b0…` / `p0…`). Active table is 6×8 (cap 4) or 5×6 (cap 2) when `lowDetail` **or** `narrow` (390) **or** reduced-motion. Extra ids are **parked** (row/slot outside the active table), never deleted. Replace singular `hauntId`/`phase` with `haunts: Haunt[]`. After retreat, cool that book and seed another idle haunt (skip immediate repeat). Render a pool of 4 reused ghost groups; books keep shared geometries.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright.

## Global Constraints

- Ancestor `0394185` (PR #51 cloud left/right, itself on Operation `aeb766a` PR #50). Branch `cursor/shelf-full-haunts-4e4e`, stack on PR #51, base `cursor/cloud-left-right-4e4e`. Preserve WIP `ab7b30b` by cherry-pick; do not drop cloud/truck/operation fixes.
- Preserve truck, cloud left/right, operation. Do not edit those games except sibling boot URLs in shelf e2e.
- High: **6×8 = 48**, ~36 books + 12 props, **4** haunts. Compact: **5×6 = 30**, ~22 books + 8 props, **2** haunts.
- Low-detail toggle **cannot drop books**. Park extras; restore on high.
- Auto-refill after retreat. No one-ghost-per-round limitation. Rearrange while other ghosts play.
- No jumpscare / chase / dark sting. Audio off default.
- Schema **3**. Schema 2: parse by **id**, notice 「货架又添了几格。」 Schema 1: settings only, notice 「货架换了样子，书还在等你摆。」
- `data-haunt` comma-separated ids. `data-items` = **visible** cell count.
- 44×44 CSS px on `pointer: coarse` / 390. Safe-area on HUD. 2D CSS-face fallback if WebGL fails (no emoji ghosts).
- No paid assets. Procedural, not photoreal. Cooking / Hospital out of this batch.

## File map

- Modify: `web/src/lib/games/shelf/sim.ts` + `sim.spec.ts`
- Modify: `web/src/lib/games/shelf/persist.ts` + `persist.spec.ts`
- Modify: `web/src/lib/games/shelf/render.ts` — taller/wider case, 4 ghost pool, pads for 48, hide parked
- Modify: `web/src/lib/games/shelf/ShelfPlay.svelte` — multi-haunt HUD/bubbles, 2D grid, 44px, narrow flag
- Modify: `web/src/lib/games/catalog.ts` + `catalog.spec.ts`
- Modify: `web/e2e/memory-shelf.e2e.ts`

## Self-review vs spec

| Spec | Plan |
|---|---|
| 48 / 30 tables + 4 / 2 caps | `tableOf`, `fillHigh`, `visibleItems` |
| Park extras, toggle cannot drop | items always 48; compact hides row≥5 or slot≥6 |
| Independent haunts, own book, 对不起, same-book retreat | `haunts[]`, tick per haunt, pose ghost at that book |
| Auto-refill, avoid immediate repeat, cool until others had a turn | `coolIds` + `seedHaunts` |
| No global one-ghost lock | pick/place other items while a ghost plays |
| Schema 3 / 2 by id / 1 settings | persist rewrite |
| 2D fallback | CSS grid + CSS faces |
| Natural 390 rearrange + ghost tap | e2e pointer, 44px |

---

### Task 1: Sim — 48/30, concurrent haunts, refill

**Files:** `web/src/lib/games/shelf/sim.ts`, `sim.spec.ts`

**Interfaces:**

```ts
export const HIGH_ROWS = 6;
export const HIGH_SLOTS = 8;
export const LOW_ROWS = 5;
export const LOW_SLOTS = 6;
export const HIGH_HAUNT_CAP = 4;
export const LOW_HAUNT_CAP = 2;

export type Haunt = { bookId: string; phase: HauntPhase; phaseT: number };

export type ShelfWorld = {
  items: ShelfItem[]; // always 48
  haunts: Haunt[];
  coolIds: string[];
  lastHauntIds: string[];
  heldId: string | null;
  notice: string;
  paused: boolean;
  over: boolean;
  lowDetail: boolean;
  narrow: boolean;
  reducedMotion: boolean;
  audioWanted: boolean;
  dockCollapsed: boolean;
  recovered: boolean;
  round: number;
  t: number;
};

export function isCompact(w): boolean; // lowDetail || narrow || reducedMotion
export function tableOf(w): { rows: number; slots: number; cap: number };
export function visibleItems(w): ShelfItem[];
export function hauntIdsOf(w): string[];
export function hauntOf(w, bookId): Haunt | undefined;
export function shelfPhase(w): HauntPhase; // first PLAYING else idle
export function anyApology(w): boolean;
export function seedHaunts(w, rng): void;
export function applyTable(w, rng): void; // trim haunts to cap, reseed
```

- [x] **Step 1: Failing tests** (rewrite `sim.spec.ts`)

```ts
it('high fill is 48 cells with ~36 books and 12 props', () => {
  const world = createShelf(() => 0.2);
  expect(world.items).toHaveLength(48);
  expect(world.items.filter((i) => i.kind === 'book')).toHaveLength(36);
  expect(world.items.filter((i) => i.kind === 'prop')).toHaveLength(12);
  expect(new Set(world.items.map((i) => i.id)).size).toBe(48);
  expect(new Set(world.items.map((i) => `${i.row}:${i.slot}`)).size).toBe(48);
  expect(hauntIdsOf(world)).toHaveLength(4);
  expect(new Set(hauntIdsOf(world)).size).toBe(4);
});

it('compact table is 30 visible cells and haunt cap 2 without dropping ids', () => {
  const world = createShelf(() => 0.2);
  const ids = world.items.map((i) => i.id).sort();
  world.lowDetail = true;
  applyTable(world, () => 0.3);
  expect(world.items).toHaveLength(48);
  expect(visibleItems(world)).toHaveLength(30);
  expect(visibleItems(world).filter((i) => i.kind === 'book').length).toBeGreaterThanOrEqual(20);
  expect(hauntIdsOf(world).length).toBeLessThanOrEqual(2);
  world.lowDetail = false;
  applyTable(world, () => 0.3);
  expect(world.items.map((i) => i.id).sort()).toEqual(ids);
  expect(visibleItems(world)).toHaveLength(48);
});

it('two books cry at once with separate haunt state', () => {
  const world = createShelf(() => 0.1);
  const [a, b] = hauntIdsOf(world);
  pickItem(world, a);
  pickItem(world, b);
  expect(hauntOf(world, a)?.phase).toBe('emerge');
  expect(hauntOf(world, b)?.phase).toBe('emerge');
  drive(world, 2000);
  expect(['face', 'cry', 'sorry']).toContain(hauntOf(world, a)?.phase);
  expect(['face', 'cry', 'sorry']).toContain(hauntOf(world, b)?.phase);
  expect(hauntOf(world, a)?.phaseT).not.toBeUndefined();
});

it('apology is 对不起 and the ghost returns to the same book then auto-refills a different idle haunt', () => {
  const world = createShelf(() => 0.15);
  const book = hauntIdsOf(world)[0]!;
  pickItem(world, book);
  let saw = false;
  for (let i = 0; i < 200; i++) {
    stepShelf(world, 40);
    if (hauntOf(world, book)?.phase === 'sorry' && anyApology(world)) {
      saw = true;
      expect(world.notice).toMatch(/对不起/);
    }
  }
  expect(saw).toBe(true);
  expect(hauntIdsOf(world)).not.toContain(book);
  expect(world.coolIds).toContain(book);
  expect(hauntIdsOf(world)).toHaveLength(4);
  expect(hauntIdsOf(world)[0]).not.toBe(book);
  pickItem(world, book);
  expect(hauntOf(world, book)).toBeUndefined();
});

it('rearranges a non-haunt while another ghost plays; no dupe or loss', () => {
  const world = createShelf(() => 0.4);
  pickItem(world, hauntIdsOf(world)[0]!);
  const busy = new Set(hauntIdsOf(world));
  const a = world.items.find((i) => i.kind === 'book' && !busy.has(i.id))!;
  const b = world.items.find((i) => i.id !== a.id && i.row === a.row)!;
  const ids = world.items.map((i) => i.id).sort();
  pickItem(world, a.id);
  placeHeld(world, b.row, b.slot);
  expect(itemAt(world, b.row, b.slot)?.id).toBe(a.id);
  expect(world.items.map((i) => i.id).sort()).toEqual(ids);
  expect(new Set(world.items.map((i) => `${i.row}:${i.slot}`)).size).toBe(48);
});
```

Also keep pause / reduced-motion sorry / unique swap tests, rewritten onto `haunts[]`.

- [x] **Step 2: RED** `cd web && npx vitest --run src/lib/games/shelf/sim.spec.ts`
- [x] **Step 3: Implement `sim.ts`**
  - `fillHigh()`: row-major 6×8; prop when `(row + slot) % 4 === 0` and `propI < 12` (yields 12 props / 36 books; compact 5×6 yields 8 props / 22 books).
  - Extend `BOOK_TITLES` to ≥36 short Chinese titles.
  - `seedHaunts`: while `haunts.length < cap`, pick visible book not in haunts/cool; if pool empty, drop cool ids that are not currently haunting, retry; never pick the book that just retreated in the same call.
  - Tick **each** playing haunt independently. On `retreat`→`done`: push `coolIds`, drop haunt, `seedHaunts`.
  - `pickItem`: idle haunt tap starts emerge (no hold). Playing haunt book ignored. Other items hold for swap. **Do not** block the whole shelf.
  - `placeHeld`: clamp to **active** table; swap; reject if held or occupant is a playing haunt book.
  - `nextRound`: optional reshuffle — cool current haunt ids, clear haunts, `round++`, seed, keep layout.
  - `slotWorld(row, slot, table)`: high gapX 0.30 / gapY 0.46; compact gapX 0.34 / gapY 0.50.
  - Remove global `hauntId` / `phase` / `apology` fields (derive via helpers).
- [x] **Step 4: GREEN**
- [x] **Step 5: Commit** `feat(shelf): 48-cell case with four independent haunts`

---

### Task 2: Persist schema 3

**Files:** `persist.ts`, `persist.spec.ts`

- [x] **Step 1: Failing tests**

```ts
expect(SHELF_SCHEMA).toBe(3);
// schema 2: b0 title+slot survive; items 48; notice 货架又添了几格; hauntIds wrap hauntId
// schema 1: settings kept; 48 ids; notice 货架换了样子
// lowDetail true: visible 30, items 48, toggle off restores parked ids
// sibling qingxin.games.cargo-haul schema 2 and cloud-walk schema 3 and operation schema 2 untouched
// written save has hauntIds array, no required singular hauntId
```

- [x] **Step 2: RED**
- [x] **Step 3: Implement**
  - `SHELF_SCHEMA = 3`
  - Parse items **by id** against `fillHigh()` template. Keep matching ids' titles/tone/kind and in-range slots; fill leftover template cells; resolve slot collisions by giving the later item its template slot.
  - `hauntIds` if present (cap 4, valid books); else wrap schema-2 `hauntId`.
  - Persist `coolIds`, `round`, settings. Do not persist playing phases (reload → idle haunts).
  - Schema 2 notice 「货架又添了几格。」 and write schema 3.
- [x] **Step 4: GREEN**
- [x] **Step 5: Commit** `feat(shelf): migrate memory-shelf saves to schema 3`

---

### Task 3: Render + HUD + catalog

**Files:** `render.ts`, `ShelfPlay.svelte`, `catalog.ts`, `catalog.spec.ts`

- Case: 6 boards / 8-slot width on high; hide top board + last two slot columns when compact (do **not** keep 48 drawn book groups — parked `g.visible = false`).
- Ghost **pool of 4** cloned from one factory (shared geos). Pose each playing/emerging haunt at **its** book. Cry tears + 对不起 HTML bubble per sorry haunt (clamp so bubbles stay inside stage, not over the top bar).
- Camera: high lookAt ~y 1.55, z pull ~3.6; 390/compact pull ~4.4, fov 50. Books must remain raycast-pickable (pads ≥ slot gap).
- `inLod` replaced by `visibleItems` membership. Low-detail: fewer lights, extras/window off, 2 ghosts max.
- `projectGhost(index?)`, `hit` unchanged besides pads for 48.
- ShelfPlay: `world.narrow = canvas width < 500`; `applyTable` on resize/toggle. `data-haunt` comma list, `data-items` visible count, `data-hcount`, `data-h0`…`data-h3` ids + `hx0/hy0`. Pointer: haunt tap starts ghost; drag/tap-tap still swaps. Coarse 44px on dock + 2D cells. Safe-area already on HUD.
- 2D fallback: CSS grid of cells (no emoji); CSS oval face + 对不起 when sorry.
- Catalog: drop 「每轮只有一本」; say 最多四只鬼会同时钻出来道歉.

- [x] Commit `feat(shelf): denser case, four ghost meshes, 2D fallback`

---

### Task 4: Playwright

**File:** `web/e2e/memory-shelf.e2e.ts`

Natural pointer only. No `evaluate` haunt writes.

- 1280 high: `data-items=48`, rearrange two non-haunt books (2 layout lines change), tap 4 haunt ids, pause at cry with `hcount≥2` and distinct geometry, pause at sorry with visible `对不起！`, haunt returns, auto-refill `data-haunt` changes, reload keeps layout, low-detail toggle visible 30 then back 48 same ids.
- 390: `data-items≤30`, `hcount≤2`, rearrange, ghost tap, apology visible, dock buttons ≥44px, no HUD covering books (haunt project y inside canvas, below header).
- Schema 2 init: b0 survives, schema 3, notice 又添了几格.
- Schema 1: settings + 货架换了样子, written schema 3.
- Audio starts only after 书房声.
- Siblings: cargo-haul, cloud-walk, **operation**.

Inspect 1280 + 390 PNGs: packed shelf, ghosts, apology — not catalog-only.

- [x] Commit `test(shelf): concurrent haunts and 48-cell e2e`

---

### Task 5: Verify + PR

`npx svelte-check --threshold error`; `npx vitest run`; `CI=1 npx playwright test e2e/memory-shelf.e2e.ts`. Copy inspected PNGs to `/opt/cursor/artifacts/`. Push. ManagePullRequest create stack_on **51**, base `cursor/cloud-left-right-4e4e`. STOP.
