# 上班 workday upgrade (approved 2026-11-19)

Ge approved: **Yes, build this 上班 design with the larger scene, staff activities, staged work and daily logs.** This records that design against the live Qingxin tree. No further approval pause.

Workstream: extend open PR 37 on `cursor/shangban-stage1-4e4e` (inspect head `c77d93ef7f031ad0e2ba9eaf83d4f8553e032a24`). Keep Stage 1 floors/roles/guest play, 积木台, retired modules, space-glass chrome, pinned header, login HTTP/mock split. Do not merge, deploy, Mac-sync, or change auth/accounts.

This is **not** Stage 2 career/social/gifts. Linked cross-department quests, relationship meters, and 360 reviews stay out.

## Player fantasy

You work inside a readable office, not a postage-stamp building floating in black space. Staff type, haul, repair, meet, chat, drink coffee, and ride the elevator on bounded paths. Work is a process: accept, prepare at the station, perform with a real remaining-time bar, then submit. The day has a morning, lunch, afternoon, and close. When the office closes you read a faithful log, then choose 下一天.

If the canvas is still a tiny distant stack under a huge bottom panel, or a job is only a CSS bar with no checkpoints, this failed.

## Layout and camera

- **Desktop (≥900px) and landscape:** roughly **three-quarters LEFT** is the live 3D office, **narrow glass rail RIGHT** holds work, day, and log. In-game rail is not the app sidebar. AppShell still hides the top bar on `/modules/shangban`. `← 返回模块` stays.
- **Phone portrait:** the scene is the prominent column. Controls collapse behind 收起操作 / 打开操作 (default open). Targets in the canvas stay tappable; the dock must not cover stations.
- **Camera:** fix **framing**, not only canvas CSS size. Play mode focuses/zooms the **current floor** so people and furniture are legible (tighter ortho frustum than Stage 1’s ~8.1–8.6). 俯瞰 pulls back to the five-floor cutaway. Overview remains selectable. Small yaw orbit stays; no free fly-cam.
- 390 / 768 / 1280 / ≥1440 and landscape: no occluded scene targets; touch and keyboard still work.

## Alive company

Staff (cap 12, default 10) run coherent routines on `pathfind` (no wall clipping, no jitter). Activities, tied to the clock:

| Activity | Where                    | When                                         |
| -------- | ------------------------ | -------------------------------------------- |
| type     | department desks         | morning / afternoon                          |
| deliver  | floor 1 inbound/bays     | morning                                      |
| repair   | floor 3 benches          | morning / afternoon                          |
| meet     | floor 2/4 tables         | morning / afternoon                          |
| chat     | reception / nearby desks | any open hours                               |
| coffee   | break chairs             | lunch window                                 |
| elevator | shaft                    | moving between floors at arrival/lunch/close |

Department props stay distinct (Stage 1 furniture plus extra desks/plants/coffee). Reuse meshes; dispose animation loops on unmount. `prefers-reduced-motion`: no bob/arm swing; activity still readable via pose/label. Pause still exists.

## Staged work

Every role keeps its Stage 1 mechanic, now wrapped in **accept → prepare → perform → submit**.

- **Accept / 推掉** optional. First offer still exists at tick 0.
- **Prepare:** player must be at the role’s workstation (location called out in the dock). Starting perform without that station is refused.
- **Perform:** remaining time and `progress` (0–1) come from the **simulation** while the player is at (or working from) that station. Walking away **pauses** progress. Do not require holding WASD/E the whole time. Mix durations, including longer jobs (engineer/CEO).
- **Checkpoints:** role-specific actions during perform (pick parcel, 报价, 检查, choose a ship plan, mark from/to floors). These are not a wait-only bar.
- **Submit:** rewards **once** on a valid submit (`payAwarded`). Progress complete + checkpoints done. Invalid submit still fails as Stage 1 (wrong bay, bad part, etc.).
- Pause / 1x·2x·3x / 重新开始 stay consistent with the sim (hidden tab still pauses; `stepWorld` still caps elapsed).
- **换岗** with active work: explicit 放下这单（取消，无薪水）or 先做完. No silent cancel, no reward on drop.

Role mapping (unchanged ids/floors):

| Role       | Prepare station | Perform / checkpoints     | Submit                     |
| ---------- | --------------- | ------------------------- | -------------------------- |
| 物流员     | 到货口          | pick parcel; walk         | place on matching A/B/C    |
| 销售顾问   | 洽谈桌          | 报价 at least once        | 提交成交 using last offer  |
| 维修技师   | 维修台          | 检查                      | choose 电源/排线/散热/主板 |
| 产品工程师 | 测试台          | pick 写测试/直接上线/重写 | 提交发版                   |
| 财务专员   | 薪酬桌/报销盘   | review time               | 通过 / 驳回                |
| 运营经理   | 编制板          | pick 从/到 floors         | 调 1 人 / 调预算           |
| 总经理     | 总经理室        | read card                 | pick a decision            |

## Day rhythm

Clock 09:00–18:00. **Do not wrap** into the next morning automatically.

| Phase     | Clock       | Notes                  |
| --------- | ----------- | ---------------------- |
| arrival   | 09:00–09:30 | staff enter            |
| morning   | 09:30–12:00 | work                   |
| lunch     | 12:00–13:00 | coffee/break preferred |
| afternoon | 13:00–17:30 | work                   |
| closing   | 17:30–18:00 | wind down              |

At 18:00: **pause**, snapshot the daily log **exactly once**, wait for 下一天. Hidden tab / offline / modal must not roll extra days. Unfinished active jobs **carry** with stage/progress. Leftover offers expire at close. Relaxed: no fail-for-timeout. `OFFER_TTL` still expires ignored offers during the day.

### Durations (document + code constants)

- `TICK_MS = 100`. At 1x, 10 ticks = 1 real second.
- `DAY_TICKS = 720` → **72s real** for 09:00–18:00 at 1x (9 in-game hours). 2x/3x shorten real time only.
- Job `durationTicks` at 1x: courier 48, sales 90, tech 80, engineer **180**, finance 72, manager 88, ceo **140**.
- Elevator 8 ticks. Break 40 ticks. Spawn every 24 ticks while live queue < 3.

## Daily logs

Saved with the world. Each closed day records: day index, role, clock span, **pay earned that day**, tasks (title, status, ticks spent, pay), notable notices, unfinished jobs (title, stage, progress). Browse previous days in the rail. Retention **14** days (oldest dropped). End-day and reward are idempotent. Reload mid-task and at end-day must restore the same stage/progress/log.

## Save

Key remains `qingxin.shangban`. Schema **2**. Schema **1** loads: keep role, pay, floor, position, company meters, live/active tasks (map `active` → stage `perform` with progress 0 if missing), NPCs. Fill day=1, logs=[], speed=1, `dayClosed=false`. Corrupt / unknown schema ≥3: fresh world, `recovered: true`, do not `removeItem` sibling keys. Guest only. No AI, backend, or login. No offline farming (hidden tab pauses; close-once).

## Bounds

Same NPC/task/package caps as Stage 1. Measure paint cadence from rAF dt (honest; not GPU FPS). Dispose renderer/geometries/observers. DPR cap unchanged.

## Out of scope

Career tracks, gifts, named relationships, Stage 3, auth, database reset, merge/deploy/Mac sync, other games.
