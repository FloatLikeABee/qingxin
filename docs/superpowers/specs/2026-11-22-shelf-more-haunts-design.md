# 记忆货架 — 48 cells, up to 4 concurrent ghosts (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). Supersedes t275u **one haunt per round**. Catalog id `memory-shelf`, route `/modules/games/memory-shelf/play`, card art, and save key stay.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured.

## Player fantasy

A packed walnut case. More books. Up to four funny ghosts at once: emerge, face, **大哭**, **对不起！**, retreat into **the same book**. No jumpscare, no chase, no dark sting. Rearrange anytime.

## What exists (HEAD `5304649`)

- `ROWS = 4`, `SLOTS = 7` → 28 cells (~22 books + 6 props). One `hauntId`. Phases emerge → face → cry → sorry → retreat → done. 下一轮 picks a new book.
- Save `qingxin.games.memory-shelf` schema **2**. Schema 1 keeps settings and rebuilds the case.
- Audio whimpers opt-in, default off. One ghost group in `render.ts`.

## Approaches

### A. Same 4×7, only faster haunt rolls (reject)

Fails “more books” and concurrent ghosts.

### B. Second room / second case (reject)

Worse on 390. Out of v1.

### C. Recommend: one taller case, concurrent funny ghosts

## Layout (design numbers, not measurements)

| Mode | Rows × slots | Cells | Books + props (target) | Max concurrent haunts |
|---|---|---|---|---|
| High | **6 × 8** | **48** | ~36 books + 12 props | **4** |
| Low-detail **or** 390 **or** reduced-motion | **5 × 6** | **30** | ~22 books + 8 props | **2** |

Low-detail **must** drop both capacity and concurrency as above. Do not keep 48 meshes at 2 ghosts, and do not keep 4 ghosts on 30 cells.

Book `id` values `b0…` and prop `id` values `p0…` from schema 2 **keep their ids, titles, and grid slots** when those cells still exist (row < new ROWS, slot < new SLOTS). New cells get new ids. Settings `lowDetail`, `audioWanted`, `dockCollapsed` persist.

Switching high → low-detail (or 390) **does not delete** extra ids: park items whose row/slot fall outside 5×6, restore them when high-detail returns. Haunt cap follows the **active** table (2 vs 4).

## Haunt rules

- Up to 4 (or 2 in low-detail) **independent** haunts, each bound to its **own book**.
- Sequence per ghost: emerge → face → cry → sorry (visible **对不起！**) → retreat into **that** book. Funny, not scary. No jumpscare camera lunge.
- Picking a haunted idle book starts **that** ghost if under the cap. Picking a non-haunt still rearranges.
- After retreat, that book is **cool** until every other currently eligible book has had a turn (or 下一轮 reshuffles haunt seeds). Arrangement persists.
- 下一轮 optional: refill haunt slots, skip books that just finished, keep layout.
- Audio **off** until 静音/呜咽 opt-in. Reduced-motion: same five beats, shorter times (existing `PHASE_MS_REDUCED` family).

## Save

Key `qingxin.games.memory-shelf`. **Schema 3**.

- Schema 2: parse items by **id**; keep any whose id is still in the new fill template; extra 48-cell slots are fresh; haunt list = up to cap of still-valid book ids; notice 「货架又添了几格。」
- Schema 1: keep settings only; fresh 48-cell (or 30 if low-detail) case; existing notice 「货架换了样子，书还在等你摆。」
- Foreign schema recovers. Other `qingxin.*` keys untouched.
- Persist `hauntIds: string[]` (cap 4). Ignore a lone schema-2 `hauntId` if `hauntIds` present; else wrap it as a one-element list.

`data-haunt` becomes a comma-separated id list. `data-items` is the cell count.

## Errors / LOD

WebGL fail: 2D grid still pick/place; ghosts are emoji-free CSS faces, still 对不起！. Cannot exceed haunt cap (ignore extra starts). Low-detail: fewer lights, 30 cells, 2 ghosts. GPU unmeasured; if 390 stutters, drop to the low-detail table, do not keep 4 skinned ghosts.

## Test acceptance (when implemented)

- Unit: high fill length 48; low-detail fill 30 and max haunts 2; two books can cry at once without sharing `hauntIds`; apology phase sets 对不起！; schema 2 `b0` slot survives; schema 3 round-trip.
- Playwright: 48 items on 1280 high; 390 low-detail ≤30 and ≤2 haunts; drag-swap still works; audio starts only after opt-in; sibling catalog boots.

## Out of scope

Second room, voice acting, jumpscares, scored memory test, paid covers, merge/Mac.
