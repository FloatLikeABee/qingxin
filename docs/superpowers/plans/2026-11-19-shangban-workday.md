# 上班 workday Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Larger readable office, staff activities, staged jobs with sim progress, close-once day + daily logs, schema-2 save migration — on the same 上班 guest module.

**Architecture:** Keep `roles.ts` / `floors.ts` / Stage 1 task payloads. Add focused units: `day.ts`, `jobs.ts` (stage/progress helpers used by `tasks.ts`), `npc.ts` (routines), `logs.ts`, `camera.ts`. `sim.ts` owns world tick/pause/speed and delegates. `persist.ts` schema 2 migrates 1. `ShangbanPlay.svelte` becomes a left-scene / right-rail layout; dock is not the AppShell sidebar.

**Tech Stack:** SvelteKit 3, TypeScript strict, Vitest, Playwright, Three.js 0.187, localStorage only.

**Spec:** `docs/superpowers/specs/2026-11-19-shangban-workday-design.md`

---

### Task 1: Day rhythm, pause, speed, close-once

**Files:**

- Create: `web/src/lib/shangban/day.ts`
- Create: `web/src/lib/shangban/day.spec.ts`
- Modify: `web/src/lib/shangban/sim.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { beginNextDay, closeDay, dayPhase, DAY_TICKS } from "./day";
import { createWorld, setPaused, setSpeed, stepWorld, tickWorld } from "./sim";

describe("上班 day", () => {
  it("names arrival/morning/lunch/afternoon/closing from tick", () => {
    expect(dayPhase(0)).toBe("arrival");
    expect(dayPhase(Math.floor(DAY_TICKS * (1.5 / 9)))).toBe("morning");
    expect(dayPhase(Math.floor(DAY_TICKS * (3.2 / 9)))).toBe("lunch");
    expect(dayPhase(Math.floor(DAY_TICKS * (6 / 9)))).toBe("afternoon");
    expect(dayPhase(DAY_TICKS - 1)).toBe("closing");
  });

  it("closes exactly once at 18:00 and waits for 下一天", () => {
    const world = createWorld({ seed: 3 });
    world.tick = DAY_TICKS - 1;
    tickWorld(world);
    expect(world.dayClosed).toBe(true);
    expect(world.logs).toHaveLength(1);
    const pay = world.player.pay;
    tickWorld(world);
    tickWorld(world);
    expect(world.logs).toHaveLength(1);
    expect(world.tick).toBe(DAY_TICKS);
    expect(world.day).toBe(1);
    beginNextDay(world);
    expect(world.day).toBe(2);
    expect(world.tick).toBe(0);
    expect(world.dayClosed).toBe(false);
    expect(world.player.pay).toBe(pay);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/shangban/day.spec.ts`
Expected: FAIL (missing module / `dayClosed`).

- [ ] **Step 3: Implement day helpers and wire `tickWorld`**

`DAY_TICKS = 720`. `clockLabel` uses in-day tick clamped to `[0, DAY_TICKS]`, never modulo-wrap. `tickWorld` no-ops when `paused`, `hidden`, or `dayClosed`. At `tick >= DAY_TICKS` call `closeDay` once. `setSpeed` is 1 | 2 | 3. `stepWorld` applies `speed` extra ticks with the same 250ms/8-tick cap scaled by speed.

- [ ] **Step 4: Re-run tests**

Run: `cd web && npx vitest run src/lib/shangban/day.spec.ts src/lib/shangban/sim.spec.ts`
Expected: PASS (update any wrap-based sim tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/shangban/day.ts web/src/lib/shangban/day.spec.ts web/src/lib/shangban/sim.ts web/src/lib/shangban/sim.spec.ts
git commit -m "feat(shangban): close the workday once at 18:00"
```

---

### Task 2: Job stages, progress, checkpoints, submit-once

**Files:**

- Create: `web/src/lib/shangban/jobs.ts`
- Create: `web/src/lib/shangban/jobs.spec.ts`
- Modify: `web/src/lib/shangban/tasks.ts`, `web/src/lib/shangban/tasks.spec.ts`, `web/src/lib/shangban/sim.ts`

- [ ] **Step 1: Write failing tests** covering all 7 roles: accept→prepare (station required)→perform (sim ticks, pause/speed, walk-away pause)→checkpoint→submit once; no reward before submit; drop on role switch only when `dropActive: true`.

- [ ] **Step 2: Run** `npx vitest run src/lib/shangban/jobs.spec.ts` → FAIL.

- [ ] **Step 3: Implement** `JobStage`, `durationTicks` per role, `tickJob`, `startPerform`, `submitJob`, `dropActiveJob`. Change Stage 1 action helpers so they record checkpoints and only `reward()` when `canSubmit`. `setRole(world, id, { dropActive })`.

- [ ] **Step 4: Run** `npx vitest run src/lib/shangban/jobs.spec.ts src/lib/shangban/tasks.spec.ts src/lib/shangban/sim.spec.ts` → PASS.

- [ ] **Step 5: Commit** `feat(shangban): staged jobs with sim progress and submit-once pay`

---

### Task 3: Staff routines

**Files:**

- Create: `web/src/lib/shangban/npc.ts`, `web/src/lib/shangban/npc.spec.ts`
- Modify: `web/src/lib/shangban/sim.ts`, `web/src/lib/shangban/floors.ts` (extra props if needed)

- [ ] **Step 1: Tests** — activity by phase (coffee at lunch, type in morning, elevator at close); path stays walkable; no teleport through walls.

- [ ] **Step 2: Implement** `NpcActivity` + `tickStaff`. Replace the work/break-only loop.

- [ ] **Step 3: Commit** `feat(shangban): staff routines for typing deliveries repairs and lunch`

---

### Task 4: Daily logs + schema 2 migration

**Files:**

- Create: `web/src/lib/shangban/logs.ts`, `web/src/lib/shangban/logs.spec.ts`
- Modify: `web/src/lib/shangban/persist.ts`, `web/src/lib/shangban/persist.spec.ts`

- [ ] **Step 1: Tests** — log pay matches rewards; unfinished listed; cap 14; closeDay twice does not duplicate; schema 1 round-trip keeps role/pay/active task; schema 99 recovered; sibling keys intact.

- [ ] **Step 2: Implement** `LOG_CAP = 14`, persist `schema: 2`, migrate 1.

- [ ] **Step 3: Commit** `feat(shangban): versioned daily logs and schema 2 save migration`

---

### Task 5: Camera framing + alive scene

**Files:**

- Create: `web/src/lib/shangban/camera.ts`, `web/src/lib/shangban/camera.spec.ts`
- Modify: `web/src/lib/shangban/render.ts`

- [ ] **Step 1: Tests** — play frustum tighter than 6.5; overview larger; lookAt uses current `floorY`.

- [ ] **Step 2: Implement** closer ortho, NPC activity poses, extra furniture, reduced-motion freeze, dispose.

- [ ] **Step 3: Commit** `feat(shangban): focus the current floor and animate staff work`

---

### Task 6: Left scene / right glass rail

**Files:**

- Modify: `web/src/lib/shangban/ShangbanPlay.svelte`

- [ ] **Step 1: Layout** grid `3fr / 1fr` ≥900px and landscape; portrait scene-first + collapsible rail; progress bar + remaining time; 下一天; log browse; role-switch confirm; `data-shangban-*` hooks; `__qingxinShangban` exposes day/logs/stage.

- [ ] **Step 2: Commit** `feat(shangban): put the office on the left and a glass work rail on the right`

---

### Task 7: E2E, screenshots, recording, rAF cadence, regression

**Files:**

- Modify: `web/e2e/shangban.e2e.ts`
- Create: `web/e2e/shangban-workday.e2e.ts` if the file would otherwise bloat
- Existing: `web/e2e/games.e2e.ts`, `web/e2e/app-shell.e2e.ts`

- [ ] Guest (no seeded save): accept → checkpoint → submit, pause/resume progress, close day once, 下一天 carries unfinished, logs survive reload, role-specific controls.
- [ ] Layout 390 / 768 / 1280 / 1440 + landscape; keyboard/touch; no blocked canvas targets.
- [ ] Camera focus vs overview; NPC activity over a sped day.
- [ ] Regression 积木台 / garden / store / shooter / nav.
- [ ] Before/after screenshots + gameplay recording + `data-cadence` rAF median (not GPU FPS).
- [ ] `npm run check`, `npx vitest run`, `npm run build`, format changed files.

---

## Self-review

| Spec item                                              | Plan coverage                    |
| ------------------------------------------------------ | -------------------------------- |
| Left ¾ scene, right rail, collapsible phone, landscape | Task 6 + e2e layouts             |
| Camera focus current floor + overview                  | Task 5                           |
| 7 roles / 5 floors / elevator / guest                  | Tasks 2–6 (no role removal)      |
| Staff activities + bounded paths + reduced-motion      | Task 3 + render                  |
| Stages, sim progress, checkpoints, submit-once         | Task 2                           |
| Pause/speed/reload/role-switch explicit                | Tasks 1–2, persist, e2e          |
| Day phases, close once, carryover                      | Task 1                           |
| Logs + 14-day cap + schema 1 migrate                   | Task 4                           |
| No offline farming / no AI / no auth                   | day hidden pause + persist guest |
| Not career/social expansion                            | no new meters/gifts              |

**Not in this plan:** Stage 2/3, merge, deploy, Mac sync, login/register/reset.
