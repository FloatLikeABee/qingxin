# 手术 (proposal only — not approved, do not implement)

Independent medical-**operation game**. Not a quiz, not a static anatomy diagram, not clinical training.

**Status:** design for parent approval. **Visual/gore preference is an open parent question** and must be answered before this spec is treated as final. Do not implement until Ge approves both the loop **and** the visual lane.

## Player fantasy

A body overview. You pick a part. You then **perform a short procedure** with tools you actually move: aim, drag, hold, irrigate, close. Phases change the legal tools. Replay the same region with a seeded variation. It is a clear stylized (or, if Ge asks, more realistic) game, never a teaching hospital.

If the “operation” is multiple-choice on a still image, it failed. If only one body part exists and the rest are fake locks with no plan, it failed. If we pretend every anatomy procedure is in v1, it failed.

## Open parent question (must not be silently decided)

Please pick a visual lane before implementation:

| Id | Lane | What the player sees |
| --- | --- | --- |
| **S** (recommended default for Qingxin) | Stylized clay / toy-clinic | Smooth clay tissue, no blood spray, mistakes are “手滑了” sparks |
| **I** | Medical-illustration | Clean textbook cuts, pale tissue, minimal fluid, no gore |
| **R** | Realistic / gore | Wet tissue, blood, more intense — **only if Ge explicitly wants it** |

Until Ge answers, this document **recommends S**, and every v1 procedure is designed so I or R could re-skin meshes/materials without changing the sim. Do not ship R by default on a wellness-adjacent product.

Disclaimer on detail + play (all lanes): **这是游戏，不是医学训练，也不能用于真实诊疗。**

## What exists today

| Layer | Live behavior |
| --- | --- |
| Catalog | No `operation` id |
| 3D | `three` ^0.187, play chrome, local saves |
| Medical content | None. Do not scrape real surgical video |

CE/ECC not in repo. No paid anatomy packs.

## Approaches

### A. Quiz + labeled diagram (reject)

Tap “阑尾在哪里.” Fails manipulable tools and phases.

### B. Classic board-game cavity (too narrow)

One torso, yank rubber pieces with tweezers. Funny, but **one part**, not procedures, not replayable phases.

### C. Body map + finite tool-phase procedures (recommend)

A stylized figure is the hub. **Four v1 procedures** cover **distinct parts**. Each is a real tool loop with 3–5 phases. Replay uses a seed (splinter location, stone count, suture pattern). Further anatomy is **listed as not in v1**, not silently omitted and not promised as “all of medicine.”

**Recommendation:** C. A/B fail the brief. v1 is finite and honest.

## Recommended v1 procedures (all playable, distinct parts)

Do not ship a single-part vertical slice as the whole game.

| Id | Region | Procedure (game, not real protocol) | Tools | Replay variation |
| --- | --- | --- | --- | --- |
| `forearm` | 前臂 | Remove a splinter, irrigate, close | Tweezers, flush, suture/steri | Splinter depth/angle |
| `knee` | 膝 | Stabilize, wrap, cool | Hands, bandage, pack | Wrap start point |
| `tooth` | 口腔 | Extract a clearly toy tooth | Elevator, forceps, gauze | Which toy tooth |
| `belly` | 腹 | Lift a glowing game “stone” through a port | Scope, grasper, bag | Stone count 1–3 |

Later candidates (explicitly **not** v1): heart, eye, spine, birth, trauma bay. Name them on the body as 未开放 if shown; do not imply they work.

Unlock: all four are selectable from the start **or** two start + two unlock after one star. Prefer **all four start** so we do not fake a whole-body product. If implementation time is tight after approval, cut **replay variations**, not regions.

## Recommended v1 playable loop

1. Catalog: id `operation`, title **手术**, englishTitle **Operation**, category **益智**, tags `工具, 身体, 关卡`, playCta **开始手术**.
2. Play `/modules/games/operation/play`. First view: full-body overview, tappable regions, 返回目录.
3. Choose a region → procedure intro (one sentence, non-clinical) → **phase strip** (准备 → 操作 → 关闭).
4. Stage is a close-up 3D (or 2.5D) work area. Active tool follows pointer/finger. Tools are **not** quiz buttons: tweezers must pick, bandage must wrap along a path, flush must be held over the site, grasper must grab and move the stone into the bag.
5. Success: all phases complete → stars 1–3 from accuracy/time-optional (time is a grade, **not** a fail). Failure: drop / slip → restart phase, no graphic punishment unless lane R is chosen.
6. Back to body map. Replay same region for a new seed. Pause, low-detail, optional 器械声.

### 390 + desktop

- 1280: tool tray left or bottom, keyboard `[` `]` cycle tools, mouse drag.
- 390: tool tray as large chips (min 44px); drag on stage; no `preventDefault` on `window`.
- Reduced motion: less camera push-in; tools still move.

## Interaction systems

| System | v1 contract |
| --- | --- |
| Procedure FSM | `phase`, `tool`, `targets[]`, `complete`. Pure TS, Vitest |
| Tools | Each tool has `canAct(phase)`, `onDrag`, `onRelease`. Hits use simple volumes, not a surgical IK solver |
| Body hub | Region ids match procedures; unopened regions labeled 未开放 |
| Scoring | Accuracy of hits + drops; no medical rubric |

## Save / performance

- Key `qingxin.games.operation`, schema 1.
- Fields: `stars[procedureId]`, `lastSeed`, `visualLane` (S/I/R once chosen), `lowDetail`, `audioWanted`, `dockCollapsed`.
- Corrupt → recovered hub, notice, sibling keys safe. Never write `qingxin.theme`.
- One procedure scene mounted at a time; dispose the previous. Mesh budget modest (body hub low-poly; close-up reuses a small kit).

## Test acceptance (when implemented)

- Unit: phase transitions; illegal tool ignored; seed varies target pose; save stars.
- Playwright: open hub; select **two different** regions; complete **one** procedure by dragging a tool (assert `data-phase` / `data-complete`, not a quiz radio); replay changes seed; disclaimer visible; 390 and 1280; 返回目录. Do not accept a screenshot of a diagram as proof.

## Visual world (proposal, pending Ge)

Default **S**: clay clinic, Qingxin teal/coral tools, warm lamp, no gore. Lane I swaps materials to illustration paper. Lane R is a **parent-only** opt-in. Impeccable concept-seed **not** run.

## Out of scope until approval **and** gore/style answer

Playable body, tools, catalog card, clinical claims, extra anatomy beyond the four, paid 3D scans.
