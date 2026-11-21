# 重卡

Independent catalog game. Not 上班 relocation, not store/tide/cloud/shelf, not Stage 2/3.

**Status:** approved t275u 2026-11-21 and implemented on `cursor/cargo-haul-4e4e`.

## Player fantasy

You drive a heavy cargo truck on **wide** roads that actually turn: highway, city boulevard, countryside two-lane. You steer, throttle, and brake. The truck feels heavy (slow to get going, delayed turn-in, trailer lags). Landscape keeps generating and recycling so a long session does not grow memory. This is not a 3-lane tap-to-switch autorunner and not a postcard scrolling behind a locked truck.

If the player cannot miss a turn, it failed. If scenery is a static skybox, it failed. If the vehicle is a box that only changes lanes, it failed.

## What exists today

| Layer | Live behavior |
| --- | --- |
| Catalog | No `cargo-haul` id |
| Three.js | `three` ^0.187 already used by store/garden/shooter/上班/积木台/tide/cloud/shelf |
| Pattern | Sim in `sim.ts` + persist + `*Play.svelte` glass dock + lazy `render.ts` |
| Play skip | `/modules/games/{id}/play` already hides AppShell nebula via `isPlayView` |
| Physics libs | None. Do not add Rapier/Cannon/Ammo unless approval explicitly allows a new dependency |

CE/ECC, Context7, and paid runtimes are **not** available here and are not part of this design.

## Approaches

### A. 3-lane autorunner (reject)

Auto-throttle, tap left/right among three lanes, repeating billboards. Cheap. **Fails the brief** (no real steering, no real turns, static-feeling scenery).

### B. Road-graph + arcade heavy truck (recommend)

A planar **road graph**: each node is a wide paved piece (highway, ramp, city block, rural bend) with explicit exit edges and a minimum turn radius. The sim owns `x, z, yaw, speed, trailerYaw`. Player throttle/brake/steer integrate with mass, grip, and hitch lag. Render is a disposable Three.js view that **recycles** a pool of road + scenery instances (trees, buildings, fields) from a ring behind the camera. Connectivity is testable without WebGL: every generated node has ≥1 legal continuation; ramps actually join.

Fits Qingxin: unit-testable sim, no physics engine, bounded memory.

### C. Open-world heightmap + spline roads (defer)

A continuous countryside you can leave the pavement. Authoring and collision are a second product. v1 would fake “open” and still clip you back. Do not promise.

**Recommendation:** B. A is dishonest. C is not a first playable.

## Recommended v1 playable loop

1. Catalog (only after approval): id `cargo-haul`, title **重卡**, englishTitle **Heavy Haul**, category **驾驶** (new tile next to 飞行), tags `卡车, 公路, 无尽`, playCta **开始开车**. Do not add a coming-soon stub in this design PR.
2. Play `/modules/games/cargo-haul/play`. Dawn or late-afternoon highway, Qingxin-blue cab, coral marker lights, teal distant hills. Glass dock: 返回目录, 暂停, 低细腻, 引擎声 opt-in.
3. Spawn on a wide on-ramp already rolling slowly. Onboarding: **方向盘转向，右脚加油，左脚刹车。车很沉，弯要提前打。**
4. Controls (real, not lane taps):
   - Desktop: A/D or arrows steer, W throttle, S brake, Space handbrake, P pause.
   - 390: left two-thirds horizontal steer (virtual wheel or slide); right column 油门 / 刹车 large buttons (min 44px). `touch-action: none` **only** on the playfield.
5. World: generator emits mixed **highway / city / countryside** pieces with **feasible turns** (no 90° walls). At least one continuation always exists; optional exit appears often enough that a guest can take a city off-ramp within a few minutes. Pieces recycle; entity/mesh counts stay capped.
6. Collision: barriers and median slow you; leaving pavement is a scrape, not a void. Hard crash or jackknife → **回收** at the last on-road checkpoint, odometer kept. No game-over screen required for v1; endless until the player leaves.
7. Optional light goal (not a fail timer): pass painted depot gates for a trip log. Missing a depot just continues the road.
8. Pause on hidden tab. Reduced motion: less camera bob, still a truck. Low-detail: no shadows, fewer trees, DPR 1 on 390.

### Honest non-goals for v1

- Other traffic AI beyond a few recycled dummy cars that stay in their lanes.
- Cargo loading minigame, fuel economy career, multiplayer.
- Leaving the road into a true open map.
- Real-time weather simulation beyond a sky tint.

## Interaction systems

| System | v1 contract |
| --- | --- |
| Vehicle | Mass, max steer vs speed, trailer hitch spring-damper, brake bias. Unit-tested without Three. |
| Road graph | Seeded generator, `nextPieces(from, rng)`, turn radius check, recycle when `distanceBehind > R`. |
| Camera | Chase, slight look-ahead; O overview (same family as 上班). |
| Audio | Gesture-gated Web Audio engine rumble. Never autoplay. Stop on mute/pause/hidden/unmount. |
| WebGL fail | Sim still runs; copy 这台设备画不出公路。方向键仍可开车。 |

## Save / performance

- Key `qingxin.games.cargo-haul`, schema 1.
- Fields: `seed`, `odometer`, `checkpoint` (piece id + pose), `cargoLog[]` capped, `lowDetail`, `audioWanted`, `dockCollapsed`.
- Corrupt / unknown schema → recovered spawn, notice, **do not** wipe sibling Qingxin keys. Never write `qingxin.theme`.
- Memory: fixed pools (road ≤12, trees ≤80, buildings ≤40, dummy cars ≤6). No arrays that grow with odometer. Dispose or reuse geometries. Vitest asserts pool sizes after simulating 50 km of generation.

## Test acceptance (when implemented)

- Unit: graph always connected; turn radius; throttle raises speed; brake lowers it; steer changes yaw; recycle does not leak ids; save round-trip.
- Playwright guest (privacy consent only, **no** seeded 50 km save as the only evidence): 开始开车; throttle/steer change `data-speed` / `data-yaw`; take a generated exit (`data-biome` changes highway→city or country); crash recover keeps odometer; reload persists; 390 and 1280; pause; 返回目录. Other catalog games still open.

## Visual world (proposal)

Late-afternoon haul: wide pale asphalt, long shadows, Qingxin blue cab, gold sun, teal hills. Not neon racing. Chrome-glass dock like other games; the road is the product. Impeccable `concept-seed` was **not** run (no PRODUCT.md; these are catalog proposals, not a Qingxin identity replacement).

## Out of scope until approval

Playable route, catalog card, Three.js truck, any npm physics engine.
