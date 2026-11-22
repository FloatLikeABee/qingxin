# 云上散步 — free flight + scenery cannon (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). Supersedes the t275u cloud sandbox **no-combat** line for this workstream only. Catalog id `cloud-walk`, route, and card art stay. Not store/tide/shelf/operation/cargo/年报/上班.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured; do not claim it.

## Player fantasy

Uninterrupted ghost drift in the same cylinder. Separate **big** shots that only break scenery. Rebuild the cloud world. Not a shooter campaign, not mesh-colliding walking, not SPH explosions.

## What exists (HEAD `5304649`)

| Layer | Live behavior |
|---|---|
| Move | 6DOF. Surfaces are scenery (`onGround` always false). No sim colliders. |
| Look | `follow()` writes `lookX/Z` from the lerped camera. `world.yaw \|\| 0.15` treats yaw `0` as falsy. |
| Tap | `hitFly` returns the **first `walkMeshes` hit**, else 14 m along the ray. Garden disk, islands, city plates are walk meshes. |
| Pointer | `pointerup` does not clear `steer`. No blur/hidden key clear (cargo does). |
| Combat | None. |
| Save | `qingxin.games.cloud-walk` schema **2**. |

Measured (fixed 16 ms dt, no WebGL): open-sky W with coupled look from yaw 0 ends **8.6° / 1.26 m lateral** in 2 s; fixed look is straight. Homing to a disk point drops Y **1.2 → 0.10** and stops. Held pointer Y-range **0.92 m**. `stepSky` × 4000 ≈ **0.0025 ms/frame** — heading stutter is not sim CPU. GPU unmeasured.

## Approaches

### A. Input patches only (reject)

Fix look/`yaw`, pointerup, blur. No cannon. Fails t278u.

### B. Physics debris / SPH (reject)

Unbounded, unpaid, not asked.

### C. Recommend: free-flight + bounded scenery cannon

Keep 6DOF, bound veil, biomes, fragments, garden. Split **fly** and **fire**. Pools + rebuild.

## Movement (uninterrupted)

- WASD / arrows: XZ along **yaw**, not the lerped camera vector. Sim writes `lookX/Z` from yaw each tick. `follow()` may still chase; it **must not** write `lookX/Z`.
- Replace `world.yaw \|\| 0.15` with `world.yaw` (yaw `0` is valid). After this, hold W from look `(0,1)` stays on +Z with **\|lateral\| < 0.3** over 2 s at 16 ms dt.
- Tap / drag: fly **14 m along the camera ray**. **Never** a `walkMeshes` point. No scene-target trap.
- Pointer **up / cancel / lost capture** clears `steer`.
- `blur`, `visibilitychange` hidden, and unmount clear all keys and `steer` (same contract as cargo `releaseTouch`).
- Space / 飞升, Shift / 潜入 unchanged. Fly 0.0042, wet 0.0028, dt-cap 48 ms. Wind tube still only when **no** wish. Bound veil and 1.6 s recall stay.
- 390: no WASD stick. Canvas tap-drag is fly only.

## Fire (separate from fly)

| Device | Fly | Fire |
|---|---|---|
| Desktop | Left button drag/tap on canvas | **F** hold, or **pointer button 2**, or dock **发射**. Not left-click. |
| 390 | Tap-drag on canvas | Dock **发射** hold, min 44 px, not the canvas |

Do not bind the same desktop click to fly and fire.

**Projectile:** sphere radius ~0.7, speed ~12 m/s, life ~1.4 s. Pool **12**. 13th reuses the oldest.

**Hit:** `walkMeshes` except well ring, water volume, cavern (keep dive). Hide the mesh, spawn ≤8 box shards from a debris pool of **48**, fade ~1.2 s, **no forces, no SPH**. Ghost, creatures, hut interior, well — not breakable.

**Rebuild:** dock **重建云界** and **重新开始** restore hidden scenery and empty both pools. Pose: 重建 keeps `(x,y,z)`; 重新开始 uses existing `restartSky`.

Audio: opt-in pop, default off, stop on mute/pause/hidden/unmount.

## Save

Key `qingxin.games.cloud-walk`. **Schema 3** reads 2 and 1 with the existing pose/garden/fragment/settings mapping. Destruction is **not** persisted (rebuild is free). Foreign schema recovers. Other `qingxin.*` keys untouched.

## Errors / LOD

WebGL fail: keys still fly; cannon no-ops; notice 这台设备画不出天空。方向键仍可飞升潜入。 Pool empty: reuse oldest, no throw. Reduced-motion: shards do not spin. Low-detail: same pools, no extra lights. GPU budget unknown; if 390 drops, hide shards first, not the ghost.

## Test acceptance (when implemented)

- Unit: yaw `0` hold W, \|lateral\| < 0.3 / 2 s; `hitFly` equivalent never returns a y≈0 disk point in front of home; pointerup / blur / hidden clear keys+steer; 13th bullet reuses slot 0; hide+rebuild restores walk-mesh count.
- Playwright: canvas left-click does **not** spawn a bullet; **发射** or F does; a marked island hides; 重建 restores; 390 发射 ≥44 px and tap-drag still changes `data-x`/`data-z` without firing; sibling catalog boots.

## Out of scope

New catalog id, mesh collision, enemy combat, fluid sim, paid assets, GPU promises, merge/Mac.
