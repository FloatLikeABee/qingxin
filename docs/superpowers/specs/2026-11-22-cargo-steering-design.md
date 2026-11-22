# 重卡 — observable steering + stable mobile HUD (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). Catalog id `cargo-haul` stays. Not a new game.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured.

## Player fantasy

The wheel does what it looks like. A/D are **cab steering**. The truck sits in the clear gap between 390 controls. No sticky keys, no drifting dead steer.

## What exists (HEAD `5304649`)

Sim (yaw `0`): `ahead = (sin yaw, cos yaw)` = **+Z**; `right = (cos yaw, −sin yaw)` = **+X**; `x += sin(yaw)*speed`, `z += cos(yaw)*speed`; `yaw += (speed/WHEELBASE)*tan(steer)*dt`. **D / pad-right / `steer +1`** increases yaw in drive (nose toward **+X**). Reverse (speed &lt; 0) flips yaw vs wheel (bicycle). Keyboard and touch share sign.

Mesh: headlights `hl` x=**−0.82**, `hr` x=**+0.82**, both z=**+2.3**. **Visible nose = +Z. Driver’s right lamp = +X.** That matches sim `ahead`/`right` at yaw 0. Trailer sits at **−Z**. `cab.rotation.y = world.yaw`.

Camera today: world-space `lookAt` from `truck − ahead*back + right*2.4` at `truck + ahead*12`. Three.js camera looks down **local −Z**, Y-up, right-handed.

Input: `onKeyUp` sets `keyHeld.steer = 0` for **any** steer key (hold D, tap A, release A → 0 while D is down). Blur/hidden already `releaseTouch`. HUD: 1280 no wheel; 390/320 wheel left + pedals right. Shipped shots: truck sits **under the pedals** because of the +2.4 right offset.

### Measurement (t277u, keep)

Frozen-camera `project`: a point on sim-right / mesh **+X** had **NDC x ≈ −1.02**; D/drive moved the truck toward **screen left**. Same inversion in reverse. **The t277u “cab-right” label matches this mesh (+X = `hr`).** The error in that report was the **fix**: it prescribed camera axes `X = +right`, `Y = up`, `Z = −ahead` while looking along +Z.

## Approaches

### A. Negate steer only (reject as the sole fix)

Makes D go screen-right **while the photograph stays mirrored**. Breaks “natural cab” the moment the camera is later corrected.

### B. Left-handed / `scale.x = −1` chase (reject)

`X = right`, `Y = up`, `Z = −ahead` (look along +Z) has **X × Y = +ahead ≠ Z**. Negative determinant. Forbidden.

### C. Recommend: one right-handed heading for sim, mesh, road tangent, and camera

## Linear algebra (lock this, not a slogan)

Three.js camera: local **+X = screen right**, **+Y = screen up**, looks down **local −Z**. Right-handed: **X × Y = Z**, det **+1**. No negative-scale X.

A Y-up camera that **looks along world +Z** must have local Z ≈ **−Z_world**, therefore local X ≈ **−X_world**. So **driver’s right (+X) lands on screen left**. That is the live `lookAt` result. It is a valid RH matrix and a **wrong chase photograph** for a driver facing +Z.

A Y-up RH camera that **looks along world −Z** (Three.js default) has local X = **+X_world**. Driver’s right lands on **screen right**.

**There is no RH Y-up matrix that looks along +Z and also puts +X on screen-right.** Do not ship one.

Therefore v1 **reorients heading to Three.js native −Z**, rather than mirroring the camera:

| At yaw = 0 | Must be |
|---|---|
| Sim `ahead` | **world −Z** `(0, −1)` in xz, i.e. `(sin yaw, −cos yaw)` |
| Sim `right` | **world +X** `(1, 0)` , i.e. `(cos yaw, sin yaw)` |
| Visible nose | **world −Z** (re-author cab z, or equivalent; do **not** only `rotation.y += π`, which would swap lamps) |
| Driver’s right lamp | **world +X** (the mesh named `hr` after re-author) |
| Road sample tangent | Same `ahead` as the truck |
| Chase camera | Behind the cab on **−ahead**, look along **ahead** (world −Z at yaw 0). `lookAt` or an orthonormal basis with **X = right, Y = up, Z = −ahead**. At yaw 0 that is X=+X, Z=+Z, look −Z. det +1 |

`ahead × up = right` holds: `(0,0,−1) × (0,1,0) = (1,0,0)`.

### A/D — natural cab, not “D always screen-right”

- **Drive:** D / 右转 / pad-right → wheel right → **nose toward driver’s right** (mesh +X). With the camera above, that is **screen-right**. A is the opposite.
- **Reverse:** keep the bicycle model. Wheel right → **rear toward driver’s right**. Camera still looks **along the cab**, not along travel. Rear toward +X is screen-right while the truck moves toward the camera. State this in the dock: 倒车时方向盘仍按车头左右，不是按行驶方向。
- Do **not** promise “D is always screen-right” as a slogan (a 3/4 peek, a camera bump, or looking at a wall can break it). Promise the **signed tests** below.

## Controls and HUD

- Steer keys: a **set** of held left/right keys. Last pressed wins while both down; releasing A while D is down **keeps +1**. Touch pad unchanged (already analog, same sign as A/D).
- Blur / hidden / pause still zero steer+pedals.
- Chase **lateral offset 0** (dead-behind, existing height). Truck center of the canvas, **not** under 油门 and **not** under the wheel.
- 1280: no on-canvas wheel (unchanged).
- 390: wheel left, pedals right, truck in the gap. Top HUD already non-overlapping — keep that.
- 320: same; dock **starts collapsed**; hide `.need`. Wheel vs pedals vs dock vs top stats: no overlap (existing `boxesOverlap` helper).

Off-road yaw pull stays but must use the new `ahead`/`right` and must not invert A/D.

## Save

Key `qingxin.games.cargo-haul`. **Schema 2**.

Road graph for a given seed **changes** with the new tangent. Do not remap old `(x,z,yaw)` onto the new ribbon.

- Schema 1: keep `seed`, `odometer`, `cargoLog`, `lowDetail`, `audioWanted`, `dockCollapsed`. **Respawn on the on-ramp.** Notice 「转向修好了，从匝道再开。」
- Schema 2: store the new pose as today plus `schema: 2`.
- Foreign schema recovers. Other `qingxin.*` keys untouched.

## Errors / LOD

WebGL fail: A/D still steer the sim. Recover still on-road. Low-detail: same camera basis, fewer trees.

## Test acceptance (when implemented)

Signed **natural drive** tests (unit with Three.js `project`, no slogan):

1. Yaw 0, camera behind: `hr.project.x > hl.project.x` (driver’s right is screen-right). det of camera world basis ≈ **+1**.
2. Drive, `steer +1`, freeze camera at t=0: truck NDC x **increases**; `dRight` along sim-right **> 0**.
3. Reverse, `steer +1`, freeze camera at t=0: rear travels along sim-right (`dRight > 0` in truck-local); NDC x of the truck **increases**.
4. Hold D, tap A, release A → `steerInput` stays **+1**.
5. Schema 1 load does not keep the old `(x,z)` on the new graph; odometer kept.

Playwright 1280 / 390 / 320: HUD non-overlap including wheel/pedals/dock; 390 pad-left → `data-steer < 0`; truck bounding box (canvas space) not intersecting 油门 or 方向盘; sibling catalog boots.

## Out of scope

Physics engine, travel-direction reverse camera, `scale.x = −1`, merge/Mac.
