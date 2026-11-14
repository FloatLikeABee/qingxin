# 晴空出击 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; do not spawn reviewer agents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 夜窗拼图 with a fun, endless 2D jet shooter that is playable from the Qingxin catalog.

**Architecture:** Pure TypeScript world in `web/src/lib/games/shooter/sim.ts` (fixed timestep, AABB, bounded arrays). Canvas 2D draw in `ShooterPlay.svelte`. Catalog id `sky-sortie`; old `night-puzzle` routes redirect. Unit tests cover combat without canvas.

**Tech Stack:** SvelteKit 5 runes, Canvas 2D, Vitest, Playwright. No Three.js, no new npm deps.

## Global Constraints

- Web-only Qingxin; zh-CN UI; guest; localStorage best score only.
- Exactly 3 lives; invulnerability after a hit; auto-fire.
- Pause when `document.hidden`; cleanup rAF/listeners; cap bullets/enemies/obstacles/floats.
- Playfield `touch-action: none` only; no window-level preventDefault.
- Qingxin blue / coral / teal / gold; not purple; not Hallmark branding.
- Do not regress 便利店经理. Do not implement other coming-soon games.

---

### Task 1: Catalog rename + redirect

**Files:**
- Modify: `web/src/lib/games/catalog.ts`
- Modify: `web/src/lib/games/catalog.spec.ts`
- Modify: `web/src/lib/games/GameCover.svelte`
- Modify: `web/src/routes/modules/games/+page.svelte` (飞行 tile, hero copy)
- Modify: `web/src/routes/modules/games/[id]/+page.ts`
- Modify: `web/src/routes/modules/games/[id]/play/+page.ts`

**Interfaces:**
- Produces: `GAME_ALIASES = { 'night-puzzle': 'sky-sortie', 'corner-florist': 'window-garden' }`
- Produces: `aliasTarget(id: string): string | undefined`
- Produces: `CoverMotif` includes `'jet' | 'garden'`
- Produces: `GAME_CATEGORIES` includes `'飞行'`

- [ ] **Step 1: Write the failing catalog test**

Replace florist/night assertions with:

```ts
it('lists three playable games including 窗前庭园 and 晴空出击', () => {
  const playable = GAMES.filter((game) => game.status === 'playable');
  expect(playable.map((g) => g.id).sort()).toEqual(
    ['convenient-store', 'sky-sortie', 'window-garden'].sort()
  );
  expect(getGame('sky-sortie')).toMatchObject({
    title: '晴空出击',
    category: '飞行',
    tags: ['战机', '无尽'],
    status: 'playable',
    playCta: '开始出击'
  });
  expect(getGame('night-puzzle')).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify RED** — `npx vitest --run src/lib/games/catalog.spec.ts`
- [ ] **Step 3: Implement catalog + alias redirects + jet/garden covers**
- [ ] **Step 4: Run to verify GREEN**
- [ ] **Step 5: Commit** `catalog: replace florist/night faces with 窗前庭园 and 晴空出击`

---

### Task 2: Shooter simulation (TDD)

**Files:**
- Create: `web/src/lib/games/shooter/sim.ts`
- Create: `web/src/lib/games/shooter/sim.spec.ts`
- Create: `web/src/lib/games/shooter/persist.ts`
- Create: `web/src/lib/games/shooter/persist.spec.ts`

**Interfaces:**
```ts
export const WORLD_W = 360;
export const WORLD_H = 640;
export const TICK_MS = 16;
export const LIVES = 3;
export const INVULN_TICKS = 90;
export const MAX_BULLETS = 48;
export const MAX_ENEMIES = 24;
export const MAX_OBSTACLES = 8;
export const MAX_FLOATS = 12;

export type EnemyKind = 'scout' | 'fighter' | 'bomber';
export type ObstacleKind = 'wreck';
export type BossKind = 'fan' | 'dive' | 'ring';

export interface ShooterState {
  tick: number;
  accMs: number;
  paused: boolean;
  over: boolean;
  lives: number;
  score: number;
  invuln: number;
  fireCool: number;
  wave: number;
  waveTick: number;
  nextBossWave: number;
  boss: BossState | null;
  player: { x: number; y: number; w: number; h: number };
  aimX: number;
  aimY: number;
  bullets: Bullet[];
  enemies: Enemy[];
  obstacles: Obstacle[];
  floats: ScoreFloat[];
  nextId: number;
  rng: () => number;
}

export function createShooter(options?: { seed?: number }): ShooterState;
export function setAim(state: ShooterState, nx: number, ny: number): void; // 0..1
export function advance(state: ShooterState, elapsedMs: number): void;
export function tickShooter(state: ShooterState): void;
export function restartShooter(state: ShooterState, seed?: number): void;
export function pauseShooter(state: ShooterState, paused: boolean): void;
```

Scores: scout 50, fighter 120, bomber 200, boss 1500. Obstacles are wrecks: damage on overlap, not shot down.

Waves: duration 480 ticks (~7.7s). First boss at wave 3 (`nextBossWave = 3`), then every 3 waves, rotating fan → dive → ring. After a boss dies, spawning continues.

`advance` caps elapsedMs at 50 and at most 8 ticks per call (elapsed-time safe).

- [ ] **Step 1: Write failing tests** covering:
  - starts with exactly 3 lives, not over
  - player bullet overlapping scout: scout dies, score += 50, float spawned
  - fighter 120, bomber 200 (distinct)
  - player overlapping enemy while invuln=0: lives 2, invuln > 0
  - overlapping during invuln: lives unchanged
  - three unprotected hits: lives 0, over true
  - wreck overlap damages like an enemy
  - wreck does not decrement lives during invuln
  - `advance(5000)` does not spiral (tick increases by at most 8 per call)
  - boss spawns at wave 3 with phase `telegraph` then `attack`
  - fan boss fires a spread; dive boss changes vy; ring boss emits a ring
  - killing boss: boss null, score += 1500, wave continues (enemies still spawn later)
  - arrays never exceed MAX_* (force-spawn in a loop, then tick)
  - restart resets lives/score/over
- [ ] **Step 2: Run RED** — `npx vitest --run src/lib/games/shooter`
- [ ] **Step 3: Implement sim + persist (best score only)**
- [ ] **Step 4: GREEN**
- [ ] **Step 5: Commit** `feat(sky-sortie): seeded endless shooter simulation`

---

### Task 3: Shooter play UI

**Files:**
- Create: `web/src/lib/games/shooter/ShooterPlay.svelte`
- Modify: `web/src/routes/modules/games/[id]/play/+page.svelte`
- Delete: `web/src/lib/games/night/**`

**Play chrome:** 返回目录 / 暂停 / 重新开始. HUD: score, best, lives pips, wave. Canvas `aria-label="晴空出击"`. Pointer on canvas sets aim (normalized). Keyboard WASD/arrows. Auto-fire is sim-only. `visibilitychange` pauses. `touch-action: none` on the stage. Overlay 结束了 with score + best + 再来一局. Reduced-motion: skip tracers.

- [ ] **Step 1: Mount ShooterPlay for `sky-sortie` (and alias after redirect)**
- [ ] **Step 2: Visual pass at 390 and 1280, light/dark**
- [ ] **Step 3: Commit** `feat(sky-sortie): canvas play surface`

---

### Task 4: Playwright gameplay

**Files:**
- Modify: `web/e2e/games.e2e.ts`
- Modify: `web/e2e/screenshots.e2e.ts`
- Create: `web/e2e/endless-play.e2e.ts` (video on)

Replace night-puzzle smokes. Assert catalog heading 晴空出击, no 即将到来, CTA 开始出击. Play: canvas visible, score HUD, steer pointer, bullets (`canvas[data-fired="1"]` after first auto-shot — set from sim fire count, not a cheat). Wait for 头目 or `[data-boss="1"]`. Collide with wreck three times → 结束了.

Screenshots: `sky-play-{390,1280}-{light,dark}.png`. Recording: `sky-play-gameplay.webm`.

- [ ] **Step 1: Write e2e**
- [ ] **Step 2: Run `npx playwright test e2e/games.e2e.ts e2e/endless-play.e2e.ts`**
- [ ] **Step 3: Commit**
