# 积木台 design (approved 2026-11-17)

Ge approved: **Yes, build the sandbox with five-piece batches and remove 本地生活、AI效率工具箱、学习打卡、求职副业.** This document records that design against the actual Qingxin repo. No further approval pause. 上班 Stage 2/3 are not this change.

Workstream: extend open PR 37 on `cursor/shangban-stage1-4e4e` (head `712b375b7f7fd91ae96b1b9b09b58acd8222d245` at inspect). Keep 上班 Stage 1. Do not merge, deploy, or sync a Mac.

## What this adds

A standalone construction sandbox: **积木台**, slug `jimutai`, route `/modules/jimutai`. First-class module, not a games-catalog entry, not a floor inside 上班.

Relaxed building, not falling physics or tower balance. Guest play. No score, timer, victory, defeat, collapse, grind, tasks, or imposed target. Users snap small 3D pieces into houses, towers, sculptures, or anything connected.

## What this retires (visible surfaces only)

| Catalog name | Slug     | Live routes                            | Replacement                                                                                   |
| ------------ | -------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| 本地生活     | `local`  | `/modules/local`                       | Retired notice. Do not mount the map/list UI.                                                 |
| AI效率工具箱 | `ai`     | `/modules/ai`                          | Retired notice. Do not mount the toolbox UI.                                                  |
| 学习打卡     | `study`  | `/modules/study`, `/study`, `/study/*` | `/modules/study` shows the notice. `/study` and children 302 to it. Do not mount StudyChrome. |
| 求职副业     | `hustle` | `/modules/hustle`                      | Retired notice. Home 求职概览 card removed.                                                   |

Remove hub/home/nav/catalog/search/recommendation/account **entry points**. Pets “打开本地生活” is an entry point: drop it. Old URLs must not crash.

## Archival (keep on purpose)

Do **not** drop tables, wipe IndexedDB/localStorage, or delete writing drafts.

Keep as unused archival code/data, because a later restore should not need a migration, and this change is not a data-destruction request:

- `web/src/lib/local/**`, `web/src/lib/study/**`, `web/src/lib/hustle/**`, `web/src/lib/tools/**` (AI toolbox helpers)
- HTTP/mock mappers and `/v1/local/*`, `/v1/study/*`, `/v1/hustle/*`, `/v1/tools/*`
- Existing localStorage keys (`qingxin.hustleApplications`, study store keys, local-life keys, tools history)
- Study child route files under `web/src/routes/study/**` (unreachable once the layout redirects)
- OpenSpec archives for M4/M5/M8/M10

上班, 秘密, 窗前庭园, 便利店经理, 晴空出击, mood/finance/elder/pet/health/games, and `/modules/create` drafts stay live.

## Player fantasy

Sit at a small table of pastel blocks. Five pieces in a tray. Put them on the table. When the tray is empty, five more arrive. Look around. Undo. Keep going. Stop whenever.

If the canvas is a poster and the only play is buttons that increment a count, this failed.

## Name and route

- Name: **积木台**
- Slug / route: `jimutai` / `/modules/jimutai`
- Save: `qingxin.jimutai` schema `1`
- Title: `轻心 · 积木台`

Short, playful, a noun like 上班 and 秘密. Not buried inside the office sim.

## Inventory (the approved refill rule)

- Start with **exactly five** actual small usable pieces in the tray.
- Placing a piece **consumes that tray slot**. Invalid placement does **not**.
- Do **not** replace a piece the instant it is placed.
- When **all five of the current batch are placed**, grant **exactly five** new pieces. Not a free palette. Not infinite stock of five shape types.
- At the documented cap, the tray stays empty and the notice says the table is full.

Every batch always includes a 方块 so the next piece can sit on the ground or against a neighbor. Remaining shapes rotate through 长条 / 立柱 / 弯角 / 平板 / 台阶. All six shapes fit in a 2×2×2 envelope or smaller.

## Pieces

Cell size is small. One cube is one cell.

| Id       | Name | Cells                             |
| -------- | ---- | --------------------------------- |
| `cube`   | 方块 | `(0,0,0)`                         |
| `bar`    | 长条 | `(0,0,0) (1,0,0)`                 |
| `pillar` | 立柱 | `(0,0,0) (0,1,0)`                 |
| `ell`    | 弯角 | `(0,0,0) (1,0,0) (0,0,1)`         |
| `plate`  | 平板 | `(0,0,0) (1,0,0) (0,0,1) (1,0,1)` |
| `stair`  | 台阶 | `(0,0,0) (0,1,0) (1,1,0)`         |

Y is up. Rotation is 90° around Y and X. After rotation, cells snap so the AABB min is the origin. Colors cycle Qingxin blue / sky / coral / teal / gold.

## Placement

- Snap to the integer grid.
- Ground (`y = 0`) is a valid seat.
- Otherwise the piece must share a face with an already placed cell. No floating, no overlap, no cells outside bounds.
- Ghost shows the snapped footprint. Valid = teal, invalid = coral. Invalid click does nothing to inventory.
- Pieces stay where they are (stability without a lose state). No collapse, no wind, no HP.

## Camera and gestures

Free orbit (primary drag), pan (right button, Shift+drag, or two-finger move), zoom (wheel / pinch).

**Conflict rule:** if the pointer moves more than 10px, or two pointers are down, the gesture is camera. Placement happens only on a primary tap (pointerup with movement under 10px and a single pointer). Orbit/zoom must not place a piece.

Keyboard: `1`–`5` select tray, `R` yaw, `T` tilt, `Enter`/`Space` place at ghost, `Z` undo, `Esc` close confirm, arrows / `WASD` orbit, `+`/`-` zoom.

## Undo

Stack of placements. Each entry stores the placed piece and, if that placement granted a refill, the exact five new tray ids.

Undo the 5th piece of a batch **after refill**: discard those five unused refill pieces, put the 5th piece back in the tray, restore `batchIndex`. Later placements from the new batch must be undone first (stack order). No lost or duplicated pieces across the boundary.

No free-form pick-up of middle pieces (that would fight the five-slot tray and could float a tower). Undo is the reposition path. Reset is the wipe path.

## Reset

`清空积木台` opens a confirm. Cancel leaves tray, placed pieces, camera, and undo as they were. Confirm starts a fresh table (new five-piece batch). Never surprise-destroy.

## Bounds (not infinite)

| Cap           | Value                   | Why                                                      |
| ------------- | ----------------------- | -------------------------------------------------------- |
| Grid          | 16 × 16 × 12 cells      | Fits a phone view; camera can still inspect a tall stack |
| Placed pieces | 80 (16 batches of five) | Long session, finite save                                |
| Undo depth    | 80                      | Matches placed cap                                       |
| Cell size     | 0.36 world units        | Small pieces, long play                                  |

Copy must not say 无限.

## Save

`qingxin.jimutai` schema 1: placed, tray, rotations, selected index, batch index, undo, camera, next id, notice.

Corrupt JSON / unknown schema → fresh table with `recovered: true`. Sibling keys (`qingxin.shangban`, `qingxin.games.window-garden`, hustle/study keys, create drafts) stay. Do not rewrite a bad payload into a sibling key. Do not expose test hooks in the UI; `__qingxinJimutai` exists only when `__qingxinE2E` is set.

## Chrome

Experience mode for the table (the scene leads). Operate mode for a compact glass dock. Qingxin tokens, Outfit + Noto Sans SC, existing `.qx-glass` with the solid fallback already in `layout.css`.

390: tray and rotate/undo stay ≥44px, dock does not cover most of the table, no second row of scene-target buttons that duplicate the canvas. 1280: same composition, more table.

WebGL failure: a top-down 16×16 cell grid that still places, rotates, undoes, and saves. Same world object.

Reduced motion: no idle bob; user camera input still works.

Renderer: one box geometry, shared materials, DPR cap 1.75, dispose on leave. Do not fake an FPS counter.

## Direction contract (Impeccable, development only)

- **THESIS:** A table you keep adding small blocks to. Refuses physics-tower games, infinite palettes, and dashboard counters.
- **OWN-WORLD:** Qingxin blue sky room, wood table, pastel acrylic cubes, glass dock. Not a new brand.
- **STORY:** Five in the tray, snap, look, five more. No referee.
- **FIRST VIEWPORT:** Full-bleed table; glass header; five tray slots plus rotate/undo/reset under the canvas.
- **FORM:** Same play-view family as 上班 and 窗前庭园.
- **FINISH:** Spec, tests, 390/1280 light/dark of an actual build, short recording, inline review.

## Navigation

Primary tabs stay 首页 / 上班 / 模块 / 我的. 积木台 lives on the hub and a home card (replacing 求职概览). `/modules/jimutai` highlights 模块, not 上班. AppShell hides tabs on the play view like 上班.

## Out of scope

上班 Stage 2/3. Native apps. AI. Backend. Merging. Deploy. Mac sync. Deleting archival libraries or user records. Adding 积木台 as a fourth catalog game.
