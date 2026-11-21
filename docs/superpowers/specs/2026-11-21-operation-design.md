# 手术 (proposal — visual lane R locked; do not implement yet)

Independent medical-**operation game**. Not a quiz, not a static anatomy diagram, not clinical training, not a cartoon toy.

**Status:** Ge locked **visual lane R** (realistic and graphic, including blood) on 2026-11-21. That does **not** approve implementation of 手术, 重卡, 年报, or any pending store/tide/cloud/shelf redesign. Do not add a catalog entry or play route until Ge approves **this amended loop**.

## Player fantasy

A body overview. You pick a part. You then **operate**: incise or enter, expose tissue, use tools with the pointer, manage bleeding, finish the phase, close. Blood is visible. Exposed surgical detail is the look. It is a **fictional entertainment simulation**, never a teaching hospital.

If the “operation” is multiple-choice on a still image, it failed. If tools are only quiz buttons, it failed. If only one body part exists and the rest are fake locks with no plan, it failed. If we pretend every anatomy procedure is in v1, it failed. If the scene is clay-toy with sparkles instead of tissue and blood, it failed (lane S is **rejected**). If we promise photoreal film scans, it failed.

## Visual lane (answered)

| Id | Lane | Decision |
| --- | --- | --- |
| S | Stylized clay / toy-clinic | **Rejected** |
| I | Medical-illustration, little gore | **Rejected** |
| **R** | Realistic / graphic, blood | **Locked by Ge:** “Make Operation realistic and graphic, including blood.” |

Lanes S and I are not shipped as toggles. v1 is R only.

## Honesty: browser / Three.js fidelity

Qingxin already has `three` ^0.187. v1 **will not** look like a surgical film or a purchased anatomy atlas.

**In v1 (committed graphic game, original/procedural meshes, no paid packs):**

- Close-up region meshes with layered skin → fat → a simple muscle/socket volume.
- Wet/specular PBR-ish materials, warm OR lamp, contact shadows.
- Wound as real geometry (lips, depth), not a red decal on a sealed mannequin.
- Blood as: surface film on the wound, gauze that stains, pooled mesh in the well, a **capped** droplet/spray particle set on cut/slip.
- Tools that look like metal instruments (scalpel, forceps, suction, needle, irrigator), not emoji.

**Not in v1 (do not promise):**

- Photoreal skin pores, scanned cadaver meshes, GPU fluid/SPH, volumetric gore, licensed Visible Body / BioDigital / Unreal assets.
- Correct surgical anatomy, laterality rules, or “this is how you would operate.”
- Every body part playable.

A guest should still read it as **graphic surgery**, not a cartoon, within those limits.

## Content warning and opt-in (required)

Detail page and first play **before** the body hub:

> **内容警告：** 本游戏含写实手术画面、伤口与血液，仅供娱乐。这不是医学训练，也不能用于真实诊疗。数据与解剖均为虚构。

Required first-run control: **我已知晓，进入手术**. Play does not mount the graphic scene until that gesture. Persist `graphicAck: true` so the blocking gate does not repeat; the warning line stays on the catalog detail and as a small play HUD mark **含血腥**.

No silent autoplay of wet/surgery audio. 器械声 remains a separate opt-in (off until tapped). Mute, pause, hidden tab, and unmount all stop audio.

## What exists today

| Layer | Live behavior |
| --- | --- |
| Catalog | No `operation` id |
| 3D | `three` ^0.187, play chrome, local saves |
| Medical content | None. Do not scrape real surgical video or paid 3D scans |

CE/ECC not in repo. No paid anatomy packs. No new npm unless a later implementation approval says so.

## Approaches (unchanged recommendation)

### A. Quiz + labeled diagram (reject)

Fails manipulable tools and phases.

### B. Classic board-game cavity (reject)

One torso, rubber pieces, no graphic procedure. Conflicts with lane R.

### C. Body map + finite tool-phase procedures (recommend)

A **readable anatomical** figure is the hub (not clay doll, not a full-body atlas). **Four v1 procedures** cover **distinct parts**. Each is a real tool loop with 3–5 phases, bleeding, and close. Replay uses a seed. Further anatomy is **listed as not in v1**, not silently omitted and not promised as “all of medicine.”

**Recommendation:** C. A/B fail the brief.

## Four initial regions (kept)

Ge’s “any body part” aspiration is a **future catalog**, not a v1 promise. v1 ships these four, all selectable from the start. Extra silhouettes on the hub may read **未开放** only if labeled honestly.

| Id | Region | Fictional procedure (not a real protocol) | Tools | Graphic / blood | Replay seed |
| --- | --- | --- | --- | --- | --- |
| `forearm` | 前臂 | Incise, extract a foreign body, irrigate, suture | Scalpel, forceps, suction, irrigator, needle | Cut bleeds; well fills until suction/pressure | Depth / angle of the body |
| `knee` | 膝 | Open a laceration, control bleed, irrigate, close, wrap | Scalpel, gauze/pressure, irrigator, needle, bandage | Spurts on slip; stained wrap | Wound start point |
| `tooth` | 口腔 | Elevate and extract a marked **fictional** tooth, pack the socket | Elevator, forceps, gauze, suction | Socket bleeds; gauze soaks | Which marked tooth |
| `belly` | 腹 | Small entry, grasp a **fictional** intra-abdominal stone, bag it, close | Blade/port, grasper, bag, suction, suture | Entry bleeds; field stays wet until suction | Stone count 1–3 |

Later candidates (**not** v1, do not imply they work): heart, eye, spine, birth, trauma bay, “any organ on demand.”

If implementation time is tight **after** a later build approval, cut **replay variation richness**, not regions, and do not swap R for clay.

## Recommended v1 playable loop

1. Catalog: id `operation`, title **手术**, englishTitle **Operation**, category **益智**, tags `手术, 工具, 血腥`, playCta **开始手术**. Detail shows the content warning.
2. `/modules/games/operation/play` → blocking warning → **我已知晓，进入手术** → body overview (tappable 前臂 / 膝 / 口腔 / 腹). 返回目录.
3. Choose a region → one-line **fictional** intro (no protocol language) → **phase strip** 准备 → 显露 → 操作 → 止血/冲洗 → 关闭.
4. Close-up Three.js field. Active tool follows pointer/finger. Tools **do the work**: scalpel traces a path to open, forceps pick, suction holds on a pool to clear, irrigator sprays while held, needle follows a close path, bandage wraps a curve. Illegal tool in a phase does nothing but a notice.
5. Blood **reacts**: opening or a slip raises `bleed`; suction/pressure/gauze lowers it; closing stops new flow. `data-bleed` 0–100 for tests. Field can look messy; it is not a fail unless the phase’s target is missed.
6. All phases complete → stars 1–3 from accuracy (time is a grade, **not** a fail). Slip restarts the **phase**, not the whole body. Back to hub. Replay same region, new seed.
7. Pause, 低细腻, 少喷溅 (optional: fewer particles, **blood materials stay**), 器械声 opt-in.

### Desktop + 390

- 1280: tool tray (named instruments, min 44px), mouse drag on the field, `[` `]` cycle tools, P pause. No window-level `touchmove` / `preventDefault`.
- 390: same tray as large chips; drag on the stage only (`touch-action: none` on the canvas wrapper). Warning CTA and 我已知晓 are full-width, min 44px.
- Reduced motion: no camera lunge, particle cap 0 or very low; **wound mesh and blood film remain**. Reduced motion is not a cartoon mode.

## Interaction systems

| System | v1 contract |
| --- | --- |
| Procedure FSM | `phase`, `tool`, `targets[]`, `bleed`, `complete`. Pure TS, Vitest |
| Tools | `canAct(phase)`, `onDrag`, `onHold`, `onRelease`. Simple hit volumes, not surgical IK |
| Blood | `bleed` from cut/slip; drain from suction/pressure/pack; stain meshes; particle cap (e.g. 80, 0 if 少喷溅 or reduced motion) |
| Body hub | Four live regions; any extra part is 未开放, never a silent dummy that looks playable |
| Scoring | Accuracy of hits + drops; **no** medical rubric |

## Save / performance

- Key `qingxin.games.operation`, schema 1.
- Fields: `graphicAck`, `stars[procedureId]`, `lastSeed`, `lowDetail`, `lessSpray`, `audioWanted`, `dockCollapsed`. No `visualLane` toggle (R is the product).
- Corrupt → recovered hub **behind the warning if `graphicAck` missing**, notice, sibling keys safe. Never write `qingxin.theme`.
- One procedure scene at a time; dispose the previous. Hub is lower-poly; close-up reuses a small kit.
- **No** fluid solver. Decals + one wound mesh + capped particles. 低细腻: no shadows, DPR 1 on 390, particle cap 20.
- Long session: do not accumulate undisposed blood meshes; pool them.

## Test acceptance (when implemented)

- Unit: phase transitions; illegal tool ignored; cut raises `bleed`; suction lowers it; seed varies target pose; save `graphicAck` + stars; reduced-motion does not zero `bleed`.
- Playwright: warning gate before hub; acknowledge; select **two different** regions; complete **one** procedure by dragging a tool (assert `data-phase` / `data-complete` / `data-bleed`, not a quiz radio); blood visible in the canvas path (not only copy); replay changes seed; 390 and 1280; 器械声 starts **only** after opt-in; 返回目录.
- Do not accept a screenshot of a diagram, a clay doll, or a quiz as proof.

## Out of scope until a later **implementation** approval

Playable body, tools, catalog card, clinical claims, extra anatomy beyond the four, paid 3D scans, photoreal promises, forced audio, lanes S/I as modes, store/tide/cloud/shelf, 重卡/年报 code, merge/Mac.
