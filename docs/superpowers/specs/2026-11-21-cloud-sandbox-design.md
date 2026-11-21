# 云上散步 ghost sandbox Approach A (approved t275u 2026-11-21)

**Approved to implement.** Replaces the four-island gravity hop. Catalog **card art stays**.

## Volume

One connected cylinder **R = 42**, **Y ∈ [−14, +18]**. No loading gates, unlocks, quests, combat, or timers. `over` stays false.

## Ghost

Translucent teardrop (~0.55), opacity ~0.38, additive inner core ~0.7, **#E8F4FF / #C4B5FD**. Four wisps / short trail. Not a peach human, not a gray capsule. Soft disk blob shadow. Low-detail / reduced-motion: body + core only.

## Movement

6DOF drift. Surfaces are scenery.

| Input | Action |
|---|---|
| WASD / arrows | Camera-relative XZ |
| Space / **飞升** (hold) | +Y |
| Shift / **潜入** (hold) | −Y |
| Tap / drag | Fly toward 3D hit |
| Touch | Same dock 飞升 / 潜入, 44–48px targets |

Fly 0.0042, water/underworld 0.0028, dt-cap 48ms. **跳一下 / jump is gone.** Wind tube optional.

**Home recall:** 回家 + auto after 1.6s outside the cylinder. Notice 「云界的边把你轻轻送回家。」

## Bound

Aurora torus + veil at R ≈ 40. Soft push R 38→42. Vertical veil Y +17 / −13. `data-bound`, `data-biome`, `data-y`.

## Biomes (one mesh field)

Keep home / sun / rain / creature **coordinates** so old `(x,z)` still lands in the garden belt.

| Biome | Volume | Enter |
|---|---|---|
| 云圃花园 | Disk r=8 origin, Y 0–4 | Hut, trees, 4 garden plots, **mirror well** r=2.2 at `(0.2, 0, −0.55)` |
| 异星台地 | x 8–30, z −10–14, Y 0–9 | Coral-crystal mesas, stacked stones, planet shards |
| 倒置城 | x −10–20, z −30–−6, Y 2–16 | Instanced window boxes, stairs, kite-bridge, Möbius ribbon, tea table |
| 潜界 | Well → water Y 0..−6 r=9, grotto Y −6..−14 r=16 | Water fog + slower move, lantern-root underworld |

Optional 4 weather fragments (night in grotto). 云圃 grows only at home. Creatures roam garden + city edge.

## Camera

Chase dist 10 / height 5.2. Ray ghost→camera, pull in min 2.4. Reduced-motion snap. Occluder fade in 1.2 m cone.

## Save

Key `qingxin.games.cloud-walk`. **Schema 2** reads schema **1**: keep fragments/garden/skyMode/creatures/settings; map visited 0–3 → biomes; restore `(x,y,z)` if inside cylinder else home `(0,1,0)` with 「云界变大了，从家里再走。」 Clamps x,z −48..48, y −16..20. Foreign schema recovers; other `qingxin.*` keys untouched.

## LOD

High: nearby biome full; dive interior unbuilt until Y < −0.5. Low-detail / 390 / reduced-motion: no shadows, city = plates, alien = 3 crystals, dive = fog + 4 lanterns. Instanced city windows. Reuse box/cyl/ico.
