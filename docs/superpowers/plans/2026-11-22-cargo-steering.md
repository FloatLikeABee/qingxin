# 重卡 steering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 重卡 cab steering photograph-true: Three.js −Z heading, right-handed chase, held-key steer, schema 2 ramp respawn, truck visible between 390/320 controls.

**Architecture:** One `haulAhead`/`haulRight` pair shared by sim, road samples, scenery, ribbon, and chase camera. Re-author cab/trailer **z** (keep +X as driver’s right). Persist schema 2; schema 1 keeps odometer/settings and respawns on the on-ramp.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright.

## Global Constraints

- Ancestor `a656c32` / `5304649`. Branch `cursor/cargo-steering-4e4e`, stack on PR #47. No main/merge/Mac/force-push.
- No `scale.x = −1`, no left-handed camera, det of camera basis ≈ +1.
- Preserve arcade drive, forks, trailer, recover, dummy cars, pools.
- Sibling keys (`qingxin.theme`, other `qingxin.games.*`) untouched.
- 年报 / 潮汐 / 店 / 上班 / 手术 / 云 / 货架 out of this batch.
- GPU frame time unmeasured; do not claim it.
- Touch targets ≥44px on coarse/390 (modern-web-guidance form-factor-adaptation). Safe-area already on HUD.
- Audio default remains opt-in.

## File map

- Modify: `web/src/lib/games/cargo/sim.ts` — ahead/right, fillSamples, projectPoint, scatter, poseOnPiece, autoFollow, tick integrate
- Modify: `web/src/lib/games/cargo/sim.spec.ts` — signed drive tests
- Modify: `web/src/lib/games/cargo/persist.ts` + `persist.spec.ts` — schema 2
- Modify: `web/src/lib/games/cargo/touch.ts` + `touch.spec.ts` — `haulSteerFromHeld`
- Modify: `web/src/lib/games/cargo/render.ts` — mesh z, ribbon, camera offset 0
- Modify: `web/src/lib/games/cargo/CargoPlay.svelte` — held keys, 320 dock, copy, datasets
- Modify: `web/e2e/cargo-haul.e2e.ts` — signed world/NDC, 320 collapse, screenshots
- Create: `web/src/lib/games/cargo/camera.ts` + `camera.spec.ts` — chase pose + Three.js project tests

---

### Task 1: Heading helpers + failing signed tests

**Files:**
- Create: `web/src/lib/games/cargo/camera.ts`
- Modify: `web/src/lib/games/cargo/sim.ts` (export `haulAhead`, `haulRight`, `haulAlong`)
- Test: `web/src/lib/games/cargo/sim.spec.ts`, `web/src/lib/games/cargo/camera.spec.ts`

**Interfaces:**
- Produces: `haulAhead(yaw: number): { x: number; z: number }`, `haulRight(yaw: number): { x: number; z: number }`, `haulAlong(yaw, ds): { x, z }`, `applyHaulChaseCamera(camera, world): void`

- [ ] **Step 1: Write failing tests** (before changing production heading)

Add to `sim.spec.ts`:

```ts
import { haulAhead, haulRight } from './sim';

it('yaw 0 ahead is world -Z and right is +X', () => {
  const a = haulAhead(0);
  const r = haulRight(0);
  expect(a.z).toBeCloseTo(-1);
  expect(a.x).toBeCloseTo(0);
  expect(r.x).toBeCloseTo(1);
  expect(r.z).toBeCloseTo(0);
  expect(a.x * r.z - a.z * r.x).toBeCloseTo(1); // 2d cross = up
});

it('drive steer +1 moves toward driver right', () => {
  const world = createHaul(3);
  world.speed = 12;
  world.gear = 'drive';
  const start = { x: world.x, z: world.z, yaw: world.yaw };
  const right = haulRight(start.yaw);
  setHaulControl(world, 'steer', 1);
  setHaulControl(world, 'throttle', 1);
  stepHaul(world, 700);
  const dRight = (world.x - start.x) * right.x + (world.z - start.z) * right.z;
  expect(dRight).toBeGreaterThan(0.4);
});

it('reverse steer +1 sends the rear toward driver right', () => {
  const world = createHaul(3);
  world.speed = -7;
  world.gear = 'reverse';
  const start = { x: world.x, z: world.z, yaw: world.yaw };
  const right = haulRight(start.yaw);
  setHaulControl(world, 'steer', 1);
  setHaulControl(world, 'throttle', 1);
  stepHaul(world, 700);
  const dRight = (world.x - start.x) * right.x + (world.z - start.z) * right.z;
  expect(dRight).toBeGreaterThan(0.15);
});
```

`camera.spec.ts` uses real `three` `PerspectiveCamera.project` (no slogan):

```ts
import * as THREE from 'three';
import { applyHaulChaseCamera, cameraBasisDet } from './camera';
import { createHaul, haulRight } from './sim';

it('chase photograph puts driver-right lamp on screen-right with det +1', () => {
  const world = createHaul(3);
  const cam = new THREE.PerspectiveCamera(50, 390 / 700, 0.1, 400);
  applyHaulChaseCamera(cam, world);
  expect(cameraBasisDet(cam)).toBeGreaterThan(0.5);
  const right = haulRight(world.yaw);
  const hr = new THREE.Vector3(world.x + right.x * 0.82, 1.2, world.z + right.z * 0.82).project(cam);
  const hl = new THREE.Vector3(world.x - right.x * 0.82, 1.2, world.z - right.z * 0.82).project(cam);
  expect(hr.x).toBeGreaterThan(hl.x);
});
```

- [ ] **Step 2: Run tests, confirm RED**

Run: `cd web && npx vitest --run src/lib/games/cargo/sim.spec.ts src/lib/games/cargo/camera.spec.ts`

Expected: FAIL — `haulAhead` missing and/or `dRight` ≤ 0 with current +Z heading.

- [ ] **Step 3: Implement helpers + heading**

```ts
export function haulAhead(yaw: number) {
  return { x: Math.sin(yaw), z: -Math.cos(yaw) };
}
export function haulRight(yaw: number) {
  return { x: Math.cos(yaw), z: Math.sin(yaw) };
}
```

`fillSamples` / tick: `x += ahead.x * ds; z += ahead.z * ds`.

`projectPoint` / scatter / `poseOnPiece` / `autoFollowHaul`: lateral uses `haulRight`, along uses `haulAhead`.

Ribbon overlap and `rx,rz` in `render.ts` use the same helpers.

`applyHaulChaseCamera`: cam at `truck - ahead * back` (offset **0**), look at `truck + ahead * 12`, `up = (0,1,0)`, `lookAt`, no scale.x.

- [ ] **Step 4: GREEN those tests; existing sim.spec still pass** (forks, pools, recover odometer).

- [ ] **Step 5: Commit** `test(cargo): signed heading` then `fix(cargo): Three.js -Z heading`

---

### Task 2: Mesh re-author (not yaw+π)

**Files:** `web/src/lib/games/cargo/render.ts` `makeTruck`

Negate **local z** of cab and trailer parts so visible nose is −Z at yaw 0. Keep `hr.x = +0.82`, `hl.x = -0.82`. Do not `rotation.y += π`.

Constants: glass/bumper/grille/lamps/wheels z → negative of current; sleeper/trailer deck currently negative z → positive.

`cab.rotation.y = world.yaw` stays.

---

### Task 3: Held steer keys

**Files:** `touch.ts`, `touch.spec.ts`, `CargoPlay.svelte`

```ts
export type HaulSteerHeld = { left: boolean; right: boolean; last: -1 | 1 | 0 };

export function haulSteerFromHeld(held: HaulSteerHeld) {
  if (held.left && held.right) return held.last || 0;
  if (held.right) return 1;
  if (held.left) return -1;
  return 0;
}

export function haulSteerKeyDown(held: HaulSteerHeld, value: number) {
  if (value < 0) held.left = true;
  if (value > 0) held.right = true;
  held.last = value < 0 ? -1 : 1;
}

export function haulSteerKeyUp(held: HaulSteerHeld, value: number) {
  if (value < 0) held.left = false;
  if (value > 0) held.right = false;
  if (held.left && !held.right) held.last = -1;
  else if (held.right && !held.left) held.last = 1;
  else if (!held.left && !held.right) held.last = 0;
}
```

Test: hold D, tap A, release A → `haulSteerFromHeld === 1`.

Play: `keyHeld.steer` becomes this struct; blur/pause still `releaseTouch` zeros it. Touch pad still wins while `steerHeld`.

---

### Task 4: Schema 2 persist

**Files:** `persist.ts`, `persist.spec.ts`

`HAUL_SCHEMA = 2`.

- schema 2: restore pose as today (seed, x, z, yaw, speed, trailer, odometer, cargoLog, checkpoint, lowDetail, audioWanted, dockCollapsed).
- schema 1: `createHaul(seed)`, keep odometer, cargoLog, lowDetail, audioWanted, dockCollapsed; **do not** restore x/z/yaw; `recovered = true`; notice `转向修好了，从匝道再开。`; truck sits on generated ramp (`onRoad` true).
- foreign/corrupt: recover spawn, sibling keys untouched.
- `HAUL_SCHEMA` expectation in tests becomes 2.

---

### Task 5: HUD 1280 / 390 / 320

**Files:** `CargoPlay.svelte`

- Dock copy add: `倒车时方向盘仍按车头左右，不是按行驶方向。`
- `@media (max-width: 320px) { .need { display: none; } }` keep 44px pedals; safe-area padding already present.
- onMount: if `matchMedia('(max-width: 320px)').matches` set `dockCollapsed = true`.
- `paint`: `data-hr-ndc`, `data-hl-ndc`, `data-truck-ndc`, `data-cam-det` from scene (render `sync` writes via callback or `scene.hud()`).
- Camera offset 0 so truck is canvas-center, not under 油门.

Expose `scene.projectHud(world)` returning `{ hr, hl, truck, det }`.

---

### Task 6: Playwright signed drive + screenshots

**Files:** `web/e2e/cargo-haul.e2e.ts`

After throttle, press D (not only `|Δyaw|`):

```ts
const yaw = Number(await road.getAttribute('data-yaw'));
const x0 = Number(await road.getAttribute('data-x'));
const z0 = Number(await road.getAttribute('data-z'));
await page.keyboard.down('d');
await expect.poll(async () => {
  const x = Number(await road.getAttribute('data-x'));
  const z = Number(await road.getAttribute('data-z'));
  const rightX = Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  return (x - x0) * rightX + (z - z0) * rightZ;
}).toBeGreaterThan(0.2);
await expect.poll(async () => Number(await road.getAttribute('data-hr-ndc'))
  > Number(await road.getAttribute('data-hl-ndc'))).toBe(true);
```

Reverse: gear reverse, W, D, same `dRight > 0`.

390: pad-left `data-steer < 0`; simultaneous throttle+steer pointers (existing); blur zeros.

320: dock collapsed (`getByRole('region', { name: '重卡操作' })` hidden); wheel vs pedals vs top no overlap; shot `cargo-haul-mobile-320`.

1280/390 shots: truck not overlapping 油门/方向盘 boxes (compare `data-truck-ndc` near 0 and control bounding boxes vs estimated truck center).

Sibling boots unchanged list.

Read the three PNGs before claiming HUD.

---

### Task 7: Verify

`cd web && npx svelte-check --tsconfig ./tsconfig.json`  
`npx vitest --run`  
`CI=1 npx playwright test e2e/cargo-haul.e2e.ts` (reuseExistingServer: !CI)

Commit, push `cursor/cargo-steering-4e4e`, stacked PR on #47. STOP. No ghost/operation/shelf/cooking/hospital this run.

## Self-review vs spec

| Spec | Task |
|---|---|
| −Z ahead, +X right, RH camera, no mirror | 1, 2, 5 |
| D drive/reverse natural cab tests | 1, 6 |
| Held keys last-wins | 3 |
| Offset 0, 320 dock collapse, .need hide | 5, 6 |
| Schema 2, schema 1 ramp respawn, odometer/settings | 4 |
| Forks/trailer/recover/pools | existing sim.spec still green in 1 |
| Sibling keys | persist.spec |
| GPU unmeasured | not claimed |
