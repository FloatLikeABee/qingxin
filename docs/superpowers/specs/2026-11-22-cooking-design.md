# 烹饪 Cooking (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). **New** catalog game. Display title is **烹饪**, englishTitle **Cooking**. Do **not** ship the catalog title 灶台.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured.

## Player fantasy

Raw food on a counter. Into a pan. Heat, stir, plate. The **food mesh changes color and shape**. No tickets, no countdown, no fail.

## Approaches

### A. Order tickets / timers / customers (reject)

Rejected in t278u.

### B. Menu that prints a dish name on a still plate (reject)

Labels without cooking.

### C. Recommend: 3D counter sandbox

## Catalog / route

| | v1 |
|---|---|
| id | `home-kitchen` (stable; documented, not the display name) |
| title | **烹饪** |
| englishTitle | **Cooking** |
| category | 经营 |
| tags | `厨房, 炒菜, 烹饪` |
| playCta | **开始做饭** |
| cover motif | new `wok` (procedural pan + flame, not a photo, not 手术 lamp) |
| play | `/modules/games/home-kitchen/play` |

Search for 烹饪 must hit this card. Do not alias 灶台 as the title.

## Loop

1. Guest, local only. Glass dock: 返回目录, 暂停, 低细腻, 锅气 opt-in (default **off**).
2. Counter: bowls of **raw pieces** — 菜叶, 肉片, 蛋, 面团, 豆腐, 虾. Procedural meshes + canvas/color materials. No paid food photos.
3. Drag into the **pan**. Pan cap **12** pieces. Extra drop: soft notice **锅满了**, piece stays in the bowl. **Not** a fail, no buzzer.
4. Heat: **文火 / 武火 / 关火** (three notches, not a clock). Stir = drag in the pan (mixes, does not score).
5. **Doneness** is a per-piece `0…1` from heat×time in the sim. Visual: raw color → browned, flatten, light steam. **Independent of the dish label.** A browned 蛋 still looks browned if the label says 炒青菜.
6. Plate = drag onto a dish. Combo label is flavor (炒青菜, 煎蛋, …) after plating, never a win gate. Up to 8 plated dishes; 洗碗 clears them.
7. 重新开始 empties the pan, keeps settings. No orders.

Desktop: mouse drag. 390: drag, 44 px heat chips. `touch-action: none` on the stage only.

## Save

Key **`qingxin.games.home-kitchen`** schema 1. Fields: pan pieces (id, kind, doneness, cap 12), plated (cap 8), `lowDetail`, `audioWanted`, `dockCollapsed`. Missing / foreign schema: empty kitchen, recovered notice. **Never** read or write `qingxin.games.cargo-haul`, `cloud-walk`, `operation`, `memory-shelf`, `annual-report`, `tide-breath`, `convenient-store`, `story-clinic`, `qingxin.theme`.

## Errors / LOD

WebGL fail: 2D colored chips still drag into a pan rectangle; doneness still recolors. Reduced-motion: no steam wobble, color still shifts. Low-detail: 6 bowl kinds max, no shadows, DPR 1 on 390. GPU unmeasured.

## Test acceptance (when implemented)

- Unit: 13th pan piece rejected; doneness rises faster on 武火 than 文火; color/material function of doneness **not** of the label string; schema round-trip; sibling keys unchanged in a fake Storage.
- Playwright: catalog title **烹饪** (and English Cooking); play route `home-kitchen`; drag raw → pan → `data-doneness` increases without a timer UI; 锅满了 on overflow; 390 heat chips ≥44 px; 年报/潮汐/店/上班/手术 still boot.

## Out of scope

Recipes as real cooking instruction, nutrition claims, customers, fail timers, paid photos, merge/Mac.
