# 云上散步 free-flight + scenery cannon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uninterrupted ghost flight (no mesh homing, yaw 0 valid, pointer/blur release) plus a separate bounded scenery cannon that hides eligible meshes with visible shards and rebuild.

**Architecture:** WASD along **yaw**; sim writes `lookX/Z` from yaw each tick; `follow()` chases only. `hitFly` is always 14 m along the camera ray. Cannon lives in `cannon.ts` (pool 12 / debris 48) with `hiddenIds` on the world; render hides tagged breakable meshes and never breaks well/water/cavern/ghost/creatures/hut.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright.

## Global Constraints

- Ancestor `2d8fc7d` (PR #48 truck). Branch `cursor/cloud-cannon-4e4e`, stack on PR #48. No main/merge/Mac/force-push.
- Preserve dive well/water/grotto, bound veil, fragments, garden, wind tube, 1.6 s recall.
- Preserve truck heading fix; do not edit cargo except sibling boot list if needed.
- Destruction is **not** persisted. Schema **3** reads 1 and 2 with existing pose/garden/fragment/settings mapping.
- Sibling `qingxin.*` keys untouched.
- 发射 ≥44 px on coarse/390 (modern-web-guidance form-factor-adaptation). Safe-area already on HUD.
- Audio pop opt-in, default off. No paid assets. GPU unmeasured until this run captures `renderer.render` ms — do **not** claim 60 fps from CPU `stepSky`.
- 手术 / 货架 / Cooking / Hospital out of this batch.

## File map

- Create: `web/src/lib/games/cloud/cannon.ts` + `cannon.spec.ts` — bullets, shards, hide/rebuild, flyAim
- Modify: `web/src/lib/games/cloud/sim.ts` + `sim.spec.ts` — yaw look, wish from yaw, fireHeld, releaseSkyControls
- Modify: `web/src/lib/games/cloud/persist.ts` + `persist.spec.ts` — schema 3
- Modify: `web/src/lib/games/cloud/render.ts` — hitFly ray-only, follow no look write, yaw not `|| 0.15`, breakable tags, bullet/debris meshes, gpu ms
- Modify: `web/src/lib/games/cloud/CloudPlay.svelte` — pointerup/blur, F / button 2 / 发射, 重建云界, datasets
- Modify: `web/src/lib/games/cloud/audio.ts` — opt-in pop
- Modify: `web/e2e/cloud-walk.e2e.ts` — flight, fire, impact before/after, 390, sibling including cargo-haul

---

### Task 1: Yaw look + release + flyAim (RED then GREEN)

**Files:**
- Create: `web/src/lib/games/cloud/cannon.ts`
- Modify: `web/src/lib/games/cloud/sim.ts`
- Test: `web/src/lib/games/cloud/sim.spec.ts`, `cannon.spec.ts`

**Interfaces:**
- Produces: `flyAimAlongRay(origin, dir, dist=14): {x,y,z}`, `releaseSkyControls(world)`, look from yaw in `tick`

- [ ] **Step 1: Failing tests**

```ts
it('yaw 0 hold W stays on +Z with |lateral| < 0.3 over 2s at 16ms', () => {
  const world = createSky();
  world.yaw = 0;
  world.lookX = 0;
  world.lookZ = 1;
  world.x = 0;
  world.z = 0;
  setSkyKey(world, 'up', true);
  for (let i = 0; i < 125; i++) stepSky(world, 16);
  expect(Math.abs(world.x)).toBeLessThan(0.3);
  expect(world.z).toBeGreaterThan(2);
});

it('flyAimAlongRay never returns a y≈0 disk in front of home', () => {
  const p = flyAimAlongRay({ x: 0, y: 1, z: 0 }, { x: 0, y: -0.2, z: 1 }, 14);
  expect(p.y).toBeGreaterThan(0.4);
  expect(Math.hypot(p.x, p.y - 1, p.z)).toBeCloseTo(14, 0);
});

it('releaseSkyControls clears keys and steer', () => {
  const world = createSky();
  setSkyKey(world, 'up', true);
  setSkySteer(world, 4, 2, 4);
  world.fireHeld = true;
  releaseSkyControls(world);
  expect(world.keys.up).toBe(false);
  expect(world.steer).toBeNull();
  expect(world.fireHeld).toBe(false);
});
```

- [ ] **Step 2: Run RED** `cd web && npx vitest --run src/lib/games/cloud/sim.spec.ts src/lib/games/cloud/cannon.spec.ts`

- [ ] **Step 3: Implement**

```ts
export function flyAimAlongRay(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  dist = 14
) {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  return {
    x: origin.x + (dir.x / len) * dist,
    y: origin.y + (dir.y / len) * dist,
    z: origin.z + (dir.z / len) * dist
  };
}

export function releaseSkyControls(world: SkyWorld) {
  world.keys = { up: false, down: false, left: false, right: false, rise: false, dive: false };
  world.steer = null;
  world.fireHeld = false;
}
```

`tick`: after move, `world.lookX = Math.sin(world.yaw); world.lookZ = Math.cos(world.yaw);`  
`wish`: `lx = Math.sin(world.yaw); lz = Math.cos(world.yaw);` not `lookX/Z`.  
`SkyWorld.fireHeld: boolean` default false.

- [ ] **Step 4: GREEN existing sim.spec (dive/climb/biomes still pass).**

- [ ] **Step 5: Commit** `fix(cloud): yaw-0 look and flyAim along the camera ray`

---

### Task 2: Cannon pools + hide/rebuild

**Files:** `cannon.ts`, `sim.ts`, tests

**Interfaces:**
- `BULLET_POOL=12`, `SHARD_POOL=48`, `BULLET_SPEED=12`, `BULLET_LIFE=1400`, `SHARD_LIFE=1200`, `BULLET_R=0.7`
- `SkyBullet { live, x,y,z, vx,vy,vz, born }`
- `SkyShard { live, x,y,z, born, spin }`
- `fireSkyCannon(world, origin, dir, now): SkyBullet`
- `stepCannon(world, dt, now, breakables: Breakable[])` hides on sphere hit
- `rebuildCloud(world)` clears hiddenIds, empties live bullets/shards, keeps pose
- `Breakable { id, x, y, z, r, protect?: boolean }`

- [ ] **Step 1: Failing tests**

```ts
it('13th bullet reuses slot 0', () => {
  const world = createSky();
  const origin = { x: 0, y: 2, z: 0 };
  const dir = { x: 0, y: 0, z: 1 };
  const first = fireSkyCannon(world, origin, dir, 0);
  for (let i = 1; i < 12; i++) fireSkyCannon(world, origin, dir, i * 10);
  const again = fireSkyCannon(world, origin, dir, 200);
  expect(world.bullets).toHaveLength(12);
  expect(again).toBe(world.bullets[0]);
  expect(first.live).toBe(true);
});

it('hides a breakable island and rebuild restores count', () => {
  const world = createSky();
  const targets = [{ id: 'isle-1', x: 12, y: 1.2, z: 0.4, r: 3 }];
  world.x = 12; world.y = 1.2; world.z = -4;
  fireSkyCannon(world, { x: 12, y: 1.2, z: -4 }, { x: 0, y: 0, z: 1 }, 0);
  stepCannon(world, 400, 400, targets);
  expect(world.hiddenIds).toContain('isle-1');
  expect(world.shards.filter((s) => s.live).length).toBeGreaterThan(0);
  expect(world.shards.filter((s) => s.live).length).toBeLessThanOrEqual(8);
  const pose = { x: world.x, y: world.y, z: world.z };
  rebuildCloud(world);
  expect(world.hiddenIds).toEqual([]);
  expect(world.bullets.every((b) => !b.live)).toBe(true);
  expect(world.shards.every((s) => !s.live)).toBe(true);
  expect(world.x).toBe(pose.x);
  const protectedWell = [{ id: 'well', x: 0.2, y: 0, z: -0.55, r: 2.2, protect: true }];
  fireSkyCannon(world, { x: 0.2, y: 1, z: -6 }, { x: 0, y: 0, z: 1 }, 0);
  stepCannon(world, 800, 800, protectedWell);
  expect(world.hiddenIds).not.toContain('well');
});
```

- [ ] **Step 2–4:** Implement pool reuse (oldest `born`), sphere hit `hypot < r+BULLET_R`, spawn ≤8 shards, skip `protect`. `restartSky` also rebuilds pools. FIRE_GAP 160 ms.

- [ ] **Step 5: Commit** `feat(cloud): bounded scenery cannon pools`

---

### Task 3: Persist schema 3

**Files:** `persist.ts`, `persist.spec.ts`

- `CLOUD_SCHEMA = 3`
- Accept schema 1, 2, and 3. Same pose/garden/fragment/settings mapping. Do not store `hiddenIds` / bullets.
- Schema 1 still migrates; written schema is 3.
- Sibling keys untouched (existing tests + cargo-haul key).

---

### Task 4: Render + HUD

**Files:** `render.ts`, `CloudPlay.svelte`, `audio.ts`

`hitFly`: `flyAimAlongRay(camera.position, ray.direction, 14)` — **no** `intersectObjects(walkMeshes)`.

`follow`: `Math.sin(world.yaw)` / `Math.cos(world.yaw)` **without** `|| 0.15`. Do **not** write `world.lookX/Z`.

`addWalk(mesh, { id, protect })`: `userData.sceneryId`, `userData.protect` true for well ring, water volume/surface, cavern, dive pavement/shelf, hut walls/roof. Islands, garden disk, alien shards/mesas, city plates = breakable.

Sync: mesh.visible = !hiddenIds.includes(id); draw live bullets (sphere r 0.7), shards (boxes, no spin if reducedMotion). On bullet-mesh hit in render, if breakable call `hideBreakable(world, id, point)`.

`scene.gpuMs` from `performance.now()` around `renderer.render`. `info.render.triangles` optional.

Play:
- `onUp` / cancel / lostcapture: `releaseSkyControls` only steer+fire if pointer was fly (button 0); fire pointer (button 2) sets fireHeld false
- `blur` / `visibilitychange` hidden / unmount: `releaseSkyControls`
- Desktop: button 0 = fly; button 2 = fireHeld; `contextmenu` preventDefault on stage
- F key = fireHeld
- Dock **发射** hold (min-h-12 min-w-12, coarse 44px), **重建云界**
- Copy: 点空中飞过去。F 或右键或「发射」打碎风景，重建云界还原。
- paint: `data-steer`, `data-fire`, `data-bullets`, `data-shards`, `data-hidden`, `data-yaw`, `data-gpu`
- `tryFireSky` each frame while fireHeld using camera look (`lookX/Z` already yaw)
- pop audio on hide if unlocked

Impeccable Operate: existing dock language, no new visual world.

---

### Task 5: Playwright + screenshots

**Files:** `web/e2e/cloud-walk.e2e.ts`

Keep existing dive/climb/biome tests.

Add (or extend guest roam):

- After boot at yaw 0 (or set via evaluate): hold W, `|data-x| < 1` while `|Δz| > 2`, `data-steer` 0, no idle y-drop to 0.1.
- Canvas left-click: `data-bullets` stays 0; x/z may change while held; pointerup `data-steer` 0.
- F or 发射: `data-bullets` > 0; a marked island `data-hidden` ≥ 1; shot **before** and **after** impact 1280.
- 重建云界: `data-hidden` 0, `data-bullets` 0.
- 390: 发射 ≥44 px, ghost visible not crowded by dock; tap-drag changes x/z without firing; simultaneous 飞升+发射.
- blur: keys/steer/fire 0.
- schema 2 save still loads pose/garden (update schema 1 e2e to expect schema 3).
- Sibling boots: tide, store, shelf, 上班, **cargo-haul**.

Read PNG 1280 before/after and 390 fire+ghost before claiming.

---

### Task 6: Verify

`cd web && npx svelte-check --tsconfig ./tsconfig.json`  
`npx vitest --run`  
`CI=1 npx playwright test e2e/cloud-walk.e2e.ts`

Capture gpu dataset if present; report ms, no 60 fps claim.

Commit, push `cursor/cloud-cannon-4e4e`, stacked PR on #48. STOP. No operation/shelf/cooking/hospital.

## Self-review vs spec

| Spec | Task |
|---|---|
| WASD along yaw; follow does not write look; yaw 0 valid | 1, 4 |
| hitFly 14 m ray, never walkMeshes | 1, 4 |
| pointerup / blur / hidden clear | 1, 4 |
| F / button 2 / 发射 ≠ left click fly | 4, 5 |
| Pool 12 / debris 48, hide scenery, protect well/water/ghost/creatures/hut/cavern | 2, 4 |
| 重建 keeps pose; 重新开始 restartSky | 2 |
| Schema 3, no persist destruction | 3 |
| GPU unmeasured unless captured; no 60 fps from CPU | 6 |
| Dive/garden/fragments preserved | existing tests in 1, 5 |
