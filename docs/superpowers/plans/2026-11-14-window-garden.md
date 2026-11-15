# 窗前庭园 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; do not spawn reviewer agents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 街角花店 with a fun endless garden: 40+ distinct plants, care, bugs, harvest economy, durable local save.

**Architecture:** Plant catalog + garden sim in pure TypeScript. DOM/SVG `PlantView` so each `form` is recognizable. Beds persist through versioned JSON. Recovery action when the garden is empty and broke.

**Tech Stack:** SvelteKit 5, Vitest, Playwright. No new npm deps. No WebGL.

## Global Constraints

- Web-only Qingxin; zh-CN; guest; localStorage garden + schema validation.
- ≥40 unique plants (id, name, form, needs).
- Protect pollinators/predators; remove pests. Mistaken removal feedback.
- No final level. 空园补给 if deadlocked.
- Disclaimer: 简化玩法，不是园艺建议.
- Do not regress 便利店经理 or 晴空出击.

---

### Task 1: Plant catalog (TDD)

**Files:**
- Create: `web/src/lib/games/garden/plants.ts`
- Create: `web/src/lib/games/garden/plants.spec.ts`

**Interfaces:**
```ts
export type Need = 'low' | 'mid' | 'high';
export type PlantForm =
  | 'tomato' | 'cucumber' | 'chili' | 'eggplant' | 'lettuce'
  | 'spinach' | 'cabbage' | 'carrot' | 'onion' | 'garlic'
  | 'potato' | 'strawberry' | 'melon' | 'pumpkin' | 'corn'
  | 'rice' | 'wheat' | 'sunflower' | 'mint' | 'basil'
  | 'rosemary' | 'lavender' | 'rose' | 'peony' | 'chrysanthemum'
  | 'orchid' | 'lotus' | 'lily' | 'bamboo' | 'pine'
  | 'ginkgo' | 'maple' | 'cactus' | 'aloe' | 'succulent'
  | 'fern' | 'moss' | 'grape' | 'apple' | 'lemon'
  | 'tea' | 'jasmine';

export interface PlantDef {
  id: string;
  name: string;
  form: PlantForm;
  water: Need;
  light: Need;
  nutrient: Need;
  stageTicks: number;
  harvestValue: number;
  seedCost: number;
  unlockAt: number;
  palette: { stem: string; leaf: string; bloom: string };
}

export const PLANTS: PlantDef[];
export function plantById(id: string): PlantDef | undefined;
```

Starter unlockAt=0: tomato, lettuce, mint. Others unlock by total harvests.

- [ ] **Step 1: Failing test** — `PLANTS.length >= 40`, unique ids, unique names, unique forms, every need field is low|mid|high, starters exist
- [ ] **Step 2: RED**
- [ ] **Step 3: Author 42 plant entries**
- [ ] **Step 4: GREEN**
- [ ] **Step 5: Commit** `feat(window-garden): 42 distinct plant definitions`

---

### Task 2: Garden simulation (TDD)

**Files:**
- Create: `web/src/lib/games/garden/sim.ts`
- Create: `web/src/lib/games/garden/sim.spec.ts`

**Interfaces:**
```ts
export const BED_COUNT = 12;
export const START_COINS = 36;
export const WATER_MAX = 12;
export type Stage = 'empty' | 'seed' | 'sprout' | 'leaf' | 'bud' | 'bloom' | 'ripe' | 'wilt';
export type BugKind = 'aphid' | 'snail' | 'bee' | 'ladybug';
export type BugRole = 'pest' | 'pollinator' | 'predator';

export interface Bed {
  id: number;
  plantId: string | null;
  stage: Stage;
  progress: number;
  water: number; // 0-3
  light: number; // 0-3, shade cloth lowers effective light
  nutrient: number;
  health: number; // 0-3
  shade: boolean;
  bugs: Bug[];
}

export interface GardenState {
  tick: number;
  paused: boolean;
  coins: number;
  waterCan: number;
  fertilizer: number;
  harvests: number;
  seeds: Record<string, number>;
  beds: Bed[];
  notice: string;
  recovered: boolean;
  rng: () => number;
}

export function createGarden(options?: { seed?: number }): GardenState;
export function tickGarden(g: GardenState): void;
export function plantSeed(g: GardenState, bed: number, plantId: string): boolean;
export function waterBed(g: GardenState, bed: number): boolean;
export function feedBed(g: GardenState, bed: number): boolean;
export function toggleShade(g: GardenState, bed: number): void;
export function harvestBed(g: GardenState, bed: number): number;
export function clearWilt(g: GardenState, bed: number): boolean;
export function catchBug(g: GardenState, bed: number, bugId: number): { role: BugRole; ok: boolean };
export function buySeed(g: GardenState, plantId: string): boolean;
export function refillWater(g: GardenState): boolean;
export function buyFertilizer(g: GardenState): boolean;
export function emergencyKit(g: GardenState): boolean;
export function isDeadlocked(g: GardenState): boolean;
```

Growth: a bed advances a stage when water/light/nutrient are close to the plant's need (distance ≤ 1) and health > 0. Pests tick health down. Bees add progress. Ladybugs remove one aphid. Wilt at health 0. Harvest ripe → coins + harvests + maybe a seed. Catch pest: bug gone, small coin. Catch bee/ladybug: notice 那是益虫, coins-2 (floor 0), bug gone.

- [ ] **Step 1: Failing tests** for plant/care/harvest/replant, pest damage/removal, beneficial effect, mistaken removal notice, endless continuation (tick after harvest still accepts a new seed), deadlock + emergencyKit
- [ ] **Step 2: RED**
- [ ] **Step 3: Implement**
- [ ] **Step 4: GREEN**
- [ ] **Step 5: Commit** `feat(window-garden): care, bugs, and harvest loop`

---

### Task 3: Save schema

**Files:**
- Create: `web/src/lib/games/garden/persist.ts`
- Create: `web/src/lib/games/garden/persist.spec.ts`

Schema `{ schema: 1, coins, waterCan, fertilizer, harvests, seeds, beds, tick }`. Unknown plant ids in beds → empty that bed. `JSON.parse` throw / missing schema / beds not array → `createGarden()` + `recovered: true`.

- [ ] **Step 1: Failing tests** for round-trip, corrupt string, wrong schema, unknown plant id
- [ ] **Step 2: RED / GREEN / commit** `feat(window-garden): versioned local save`

---

### Task 4: Play UI

**Files:**
- Create: `web/src/lib/games/garden/PlantView.svelte` (one visual per `form`)
- Create: `web/src/lib/games/garden/GardenPlay.svelte`
- Modify: play dispatcher
- Delete: `web/src/lib/games/florist/**`

Layout: 12-bed grid, selected bed inspector, seed tray, tools (浇水 / 施肥 / 遮荫 / 收获 / 清空), bug chips (捉走), shop (种子 / 加水 / 肥料), 空园补给 when deadlocked. Disclaimer line. Pause on hidden tab. Autosave on tick and on unload.

- [ ] **Step 1: Build UI + wire dispatcher**
- [ ] **Step 2: Commit** `feat(window-garden): playable garden surface`

---

### Task 5: Playwright

Replace florist smokes. Catalog: 窗前庭园, 开始种植, no 即将到来. Play: plant 番茄, 浇水, wait for a pest or 害虫 chip, 捉走, wait for 收获 on ripe (or harvest after sim-fast... no cheat — keep stageTicks low enough that ripe happens in <15s of 10Hz ticks when needs match). Reload page: planted bed still there. Recording + 390/1280 light/dark screenshots `garden-play-*`.

- [ ] **Step 1: Write / run e2e**
- [ ] **Step 2: Commit**
