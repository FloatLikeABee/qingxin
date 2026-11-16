# 上班 Stage 1 design (approved 2026-11-16)

Ge approved: **Yes, build 上班 with this design in these stages.** This document records the approved Stage 1 design plus implementation choices made from the actual Qingxin repo. No further approval pause. Stage 2/3 stay roadmap, not this PR.

Branch: `cursor/shangban-stage1-4e4e` from `main` at `15a46ebb0e49e5011bc2d41def411dbed8d37e9a` (merged PR 36). Do **not** continue the PR 36 games branch. Do not merge, deploy, or sync a Mac. Do not change credentials or message third parties.

## What this replaces

The login-gated illustrative **内容创作** module (M9, hub slug `create`, route `/modules/create`, nav label 内容, home card with 小红书 / 公众号 / 抖音 / 周报). Identified from `web/src/lib/modules.ts`, `web/src/lib/nav.ts`, `web/src/routes/modules/create/+page.svelte`, and OpenSpec `content-studio`. It is the writing/content studio, not Secrets and not the games catalog.

**上班 is a first-class module**, not a fourth catalog game. 便利店经理 / 窗前庭园 / 晴空出击 and 秘密 stay untouched except navigation that currently points at 内容创作.

## Product face

Qingxin PWA, zh-CN, guest play, frontend-only. No AI gateway, no Axum call, no login, no native app. Isolated versioned localStorage save. Light/dark. Palette: Qingxin blue `#3B82F6` / `#60A5FA`, pale sky, coral, teal, gold. Scene is primary. Bento only on home/hub cards that already use it — not over the playfield.

Mode: **Experience** for the building (the scene leads), **Operate** for the compact glass dock. Inherit the existing Qingxin world (Outfit + Noto Sans SC, `qx-glass`, tokens in `layout.css`). Not Hallmark branding. Not a tycoon dashboard.

## Player fantasy

Control **one employee** walking a living five-floor company. Ride the elevator, use equipment, meet coworkers. Freely pick any advertised job and rank immediately — no grind, no unlock tree. Recurring optional work for the current role. Outcomes change department workload, company cash/morale/reputation, and personal pay/reputation.

This is not a spreadsheet with a 3D backdrop. If the canvas is a poster and the only play is three renamed buttons, Stage 1 failed.

## Five floors

| Floor | Department | Color cue | Hands-on stations |
| --- | --- | --- | --- |
| 1 | 后勤与物流 | coral bays, concrete | inbound dock, 分拣 A/B/C, break bench, elevator |
| 2 | 客户与销售 | teal tables, plants | negotiation table, complaint desk, reception |
| 3 | 产品与技术 | gold racks, whiteboards | repair bench, test bench, server rack |
| 4 | 人事与财务 | sky cabinets, paper | payroll desk, claim tray, interview chairs |
| 5 | 经营管理 | navy + gold, city window | staff board, budget board, CEO office |

Floors are distinct rooms stacked in one cutaway building, not tinted copies of one box. Elevator shaft is readable on the left. Active play camera sits on the current floor; 俯瞰 pulls back to the stacked cutaway.

## Role / task mapping (explicit)

Seven roles. All listed in the 换岗 roster. All playable on a fresh guest save with no hidden needs.

| Role id | Name | Collar | Floor | Task kind | Distinct mechanic (not a renamed click) |
| --- | --- | --- | --- | --- | --- |
| `courier` | 物流员 | blue collar | 1 | `sort` | Pick a labelled package at inbound, walk it to matching bay A/B/C, place it. Wrong bay fails. |
| `sales` | 销售顾问 | white collar | 2 | `negotiate` | Client has a hidden max price and a visible patience bar. Choose 高价 / 公道 / 让价. High wins only if max is high and patience remains; 让价 always closes cheaper. |
| `tech` | 维修技师 | blue specialist | 3 | `repair` | Device shows symptoms. 检查 reveals one clue. Pick 电源 / 排线 / 散热 / 主板. Wrong part fails and raises tech workload. |
| `engineer` | 产品工程师 | white specialist | 3 | `ship` | Ticket has severity + fault type. 写测试 always lands, slower. 直接上线 succeeds only on low severity. 重写 succeeds only on design faults. |
| `finance` | 财务专员 | white collar | 4 | `audit` | Claim vs **visible rules**: 餐补 ≤ ¥80, 加班需要审批旗标, 无票据必驳. 通过 / 驳回. Wrong call costs cash or reputation. |
| `manager` | 运营经理 | manager | 5 | `allocate` | See five department meters. Move **1 staff** or **1 budget** from a named floor to another. Source meter drops, dest rises, immediately. Stripping a floor below 1 staff causes a mishap. |
| `ceo` | 总经理 | CEO | 5 | `decide` | Decision card with three options that each change **two or more** of cash / morale / reputation / a floor's workload. Not the same as moving one staff chip. |

Default start: `courier` on floor 1 next to the elevator, inbound three tiles away, first `sort` offer already in the queue. 换岗 never teleports — player rides the elevator.

Stage 1 does **not** advertise extra roles (安保, 客服-only, 人事专员). Those wait for Stage 2 so we do not claim eight jobs and ship three.

## Work loop

- Offers spawn on simulation time for the **current role only**.
- First offer exists at tick 0 (guest reaches a task without waiting minutes).
- Later offers every 24 ticks (~2.4s at 100ms/tick) while `offered + active < 3`.
- Accept / decline are optional. Decline removes the offer. Expire after 180 ticks if ignored.
- Live queue bound: 3. History cap: 20. No resource deadlocks: declining or failing never blocks future spawns.
- Completing or failing writes pay, personal reputation, department workload, and (when relevant) company cash/morale/reputation. HUD meters move. Scene props react (bay piles, claim stack, board chips).
- Failed tasks can 重试 (same kind, new payload) from the dock.
- Role switch: drop carried package, cancel active task (`cancelled`, not `failed`), expire old-role offers, spawn one offer for the new role on the next tick. Player position unchanged.

## Simulation (Stage 1 honest)

Present now:

- Clock 09:00–18:00 mapped from tick (600 ticks/day, then wraps).
- Pause / 继续. Hidden tab (`document.hidden`) pauses. Resume does not dump a backlog: `stepWorld` caps elapsed 250ms and at most 8 ticks per frame.
- Optional 休息 (40 ticks): player cannot complete work; NPCs continue; short break does not punish.
- 10 NPCs (2/floor), cap 12. Each walks a home station ↔ break bench on a schedule. Lunch window around 12:00 they prefer break. Walk bob in the scene. **No names, no relationship meters, no gossip.**
- If any department workload ≥ 85, a one-line mishap notice can fire (package spill / angry client / overtime). Stage 1 mishaps only bump that floor's workload. They are not cross-floor quests.

Honest Stage 2 leftovers (do not fake them in copy):

- Deep coworker relationships, gifts, memory.
- Linked cross-department events (a failed repair creating a sales complaint that HR has to hire for).
- Career tracks, titles, 360 reviews.

## Scene and input

Stylized Three.js, same craft family as 便利店经理 (shared box/sphere/cyl, canvas labels, soft shadows, Qingxin cloth colors). Cutaway isometric. Player and NPCs are readable people (body/head/arms/legs), not dots. Role looks: jumpsuit vs shirt vs navy vs dark suit + coral tie.

Camera: follow current floor in play; 俯瞰 for the stack. Orbit is a small yaw, not a free fly-cam that loses the floor.

Input, desktop and 390:

- Keyboard: WASD / arrows walk, E interact, 1–5 call elevator **only when in the elevator zone**, Space pause, R 换岗, B 休息, O 俯瞰.
- Touch: tap floor tile to walk (pathfind), tap station to walk then interact, tap elevator to fill the dock with floor buttons. No hover-only tooltips. Targets ≥ 44px.
- Dock sits **below** the canvas (garden/store lesson). No second button row covering stations on 390. Contextual actions only: near elevator → floors; active sort → no extra bay strip if the scene bays are the targets; task choices live in the dock when the player is at the workstation.
- DOM twins exist for every scene-only choice (floor list, role roster, task actions) so WebGL failure still plays.

WebGL fail: written explanation **and** interactive floor/station/task DOM. Never a static screenshot.

`prefers-reduced-motion`: no walk bob, elevator is instant, camera snaps. Pause control still exists (WCAG 2.2.2). `prefers-reduced-transparency` / missing backdrop-filter: solid `var(--qx-card)` (existing `.qx-glass`). Canvas `aria-label`, live region for notices. Focus-visible rings on dock controls. Do **not** use experimental canvas-html origin trial.

Mobile DPR: cap 1.35 when height < 700, else 1.75. Dispose renderer, geometries, materials, observers on unmount.

## Navigation and legacy 内容创作

- Hub module: slug `shangban`, name 上班, accent `#3B82F6`, icon briefcase. Summary is the company, not “即将接入”.
- Primary nav: 首页 / **上班** / 模块 / 我的. Href `/modules/shangban`. 内容 tab goes away. 组件 stays off chrome.
- Home hero card that currently is 内容创作 becomes 上班 (five floor names + 去上班). 求职概览 and 秘密 stay.
- `/modules/shangban` is the full-screen play surface (AppShell hides tabs like `/play`).
- `/modules/create` **remains**. Studio, IndexedDB `create` cache, `/v1/create/*`, and mock API are not deleted. A short banner: 主入口换成上班，旧草稿还在这里. No login required to read cached drafts; generate still behaves as today.
- Tests that still exercise the studio (`content-secrets` posting, `create *` screenshots, `api.e2e` create) keep using `/modules/create`.

## Save

Key `qingxin.shangban`, schema **1**. Isolated. Corrupt JSON or unknown schema → fresh world, `recovered: true`, notice 存档读不出来，公司重新开门了. **Must not** `removeItem` other keys (garden, store, shooter, session, create cache). Guest only. Writes after meaningful actions and on pause.

## Performance / bounds

| Resource | Cap |
| --- | --- |
| NPCs | 12 |
| Live offers+active | 3 |
| Task history | 20 |
| Packages on floor | 8 |
| Ticks per frame | 8 |
| Elapsed ms per frame | 250 |

No new npm dependencies. Reuse `three@0.187`.

## Architecture units

Keep simulation, tasks, rendering, input, and save as separate files:

| File | Responsibility |
| --- | --- |
| `web/src/lib/shangban/roles.ts` | Roster, collar, floor, kind, look |
| `web/src/lib/shangban/floors.ts` | Grid, stations, walkable, pathfind, labels |
| `web/src/lib/shangban/tasks.ts` | Generate / accept / decline / act / retry / rewards |
| `web/src/lib/shangban/sim.ts` | World, tick, pause, NPCs, elevator, role switch, step cap |
| `web/src/lib/shangban/persist.ts` | Schema 1 read/write/corrupt |
| `web/src/lib/shangban/input.ts` | tryMove, interact range, elevator zone |
| `web/src/lib/shangban/render.ts` | Three.js mount/sync/pick/dispose |
| `web/src/lib/shangban/ShangbanPlay.svelte` | Glass chrome, dock, fallback, a11y |

Route: `web/src/routes/modules/shangban/+page.svelte`.

## Testing

Unit (Vitest, TDD): five floors exist and are named; every role selectable immediately; each kind's success and failure; accept/decline/expire/retry; role-switch cleanup; tick/pause/hidden-step caps; save round-trip; corrupt recovery without deleting sibling keys; NPC/task/package caps.

Playwright, **natural guest play** (no injected finished save as primary proof):

1. Move, ride elevator 1→5→1.
2. Complete a 物流员 sort.
3. Switch to 销售顾问, complete a negotiate (different controls/outcome).
4. Switch to 运营经理 then 总经理, show allocate vs decide.
5. Decline an offer; fail and 重试.
6. Complete a naturally recurring second offer after the first.
7. Reload: role, floor, pay persist.
8. 390 and 1280, light and dark screenshots; dock does not cover station targets on 390.
9. Short real recording: walk, elevator, a task.

Existing garden/store/shooter and Secrets tests stay green. Create studio tests still hit `/modules/create`.

## Out of scope (this PR)

Stage 2 social graph and cross-floor quests. Stage 3 career depth and visual polish pass. Backend persistence. Login. AI. Merging. Deploy. Games catalog entries. Deleting M9 code or data.

## Self-review

1. **Placeholders:** none. Role ids, save key, caps, tick rates, and routes are named.
2. **Consistency:** 上班 is a module, not a catalog game — matches “replace 内容创作 entry”. Legacy `/modules/create` kept so drafts survive. Elevator requires the zone so 1–5 cannot skip walking. Manager allocate ≠ CEO decide.
3. **Scope:** Stage 1 only. Seven fully implemented roles rather than a longer advertised list. NPC routines are walk/break, not relationships.
4. **Ambiguity closed:** Default role is 物流员. First offer at tick 0. Role switch does not teleport. WebGL fallback is interactive DOM, not a screenshot. Canvas-html origin trial is not used.
5. **Prior failures:** dock below canvas; every advertised role has a unique `kind` and a test; needs/rules for audit are printed in the dock; stations are in-scene pick targets plus DOM twins; onboarding is one line + an already-queued first offer, not a ready-state injector.

## Skill / tool honesty (this run)

Used: Superpowers (brainstorming already approved → spec + writing-plans + executing-plans inline + TDD + verification-before-completion), Impeccable context/craft-floor/operate as inline lenses (no PRODUCT.md; established Qingxin world inherited; no concept-seed wait — cloud agent, user already approved), modern-web-guidance search/retrieve (glass contrast, a11y, motion, canvas — skip experimental canvas-html), OpenSpec artifacts by hand.

Absent / not claimed: OpenSpec CLI, Context7 (`needsAuth` historically), Hallmark package, ECC / Compound Engineering / ponytail runtimes, reviewer subagents, premium paid services, CI watch loops.
