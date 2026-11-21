# 上班 Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; no reviewer fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 内容创作 hub/nav entry with a playable five-floor Three.js company sim (上班) on a new branch from `15a46ebb`, without deleting M9 drafts or touching Secrets / existing games.

**Architecture:** Pure TypeScript world in `web/src/lib/shangban/{roles,floors,tasks,sim,input,persist}.ts`; Three.js isolated in `render.ts`; Svelte chrome in `ShangbanPlay.svelte`. Navigation swaps the `create` module card for `shangban` while `/modules/create` stays as a legacy studio.

**Tech Stack:** SvelteKit 3, TypeScript strict, Vitest, Playwright, Three.js 0.187 already in `web/package.json`. No new dependencies.

## Global Constraints

- Base commit: `15a46ebb0e49e5011bc2d41def411dbed8d37e9a` on `main`. New branch `cursor/shangban-stage1-4e4e`. Not PR 36.
- Guest play. No AI, no backend, no login for the game.
- zh-CN copy. Qingxin blue `#3B82F6` / `#60A5FA`, pale sky / coral / teal / gold. Existing `.qx-glass`.
- Save key `qingxin.shangban` schema 1. Corrupt recovery must not delete other keys.
- All seven advertised roles playable immediately. Distinct task `kind` per row in the spec table.
- Scene primary; dock below canvas; 390 targets reachable.
- Preserve `web/src/lib/create/**`, `/modules/create`, IndexedDB `create`, `/v1/create/*`.
- Do not merge, deploy, or edit garden/store/shooter/secrets except nav that currently names 内容创作.

## File map

Create:

- `web/src/lib/shangban/roles.ts` + `roles.spec.ts`
- `web/src/lib/shangban/floors.ts` + `floors.spec.ts`
- `web/src/lib/shangban/tasks.ts` + `tasks.spec.ts`
- `web/src/lib/shangban/sim.ts` + `sim.spec.ts`
- `web/src/lib/shangban/input.ts` + `input.spec.ts`
- `web/src/lib/shangban/persist.ts` + `persist.spec.ts`
- `web/src/lib/shangban/render.ts`
- `web/src/lib/shangban/ShangbanPlay.svelte`
- `web/src/routes/modules/shangban/+page.svelte`
- `web/e2e/shangban.e2e.ts`
- OpenSpec `openspec/changes/shangban-stage1/**`
- This spec/plan pair (already named)

Modify:

- `web/src/lib/modules.ts`, `modules.spec.ts`
- `web/src/lib/nav.ts`, `nav.spec.ts`
- `web/src/lib/components/AppShell.svelte` (hide tabs on `/modules/shangban`)
- `web/src/routes/+page.svelte` (home card)
- `web/src/routes/modules/+page.svelte` (hub blurb)
- `web/src/routes/modules/[slug]/+page.ts` (exclude `shangban`)
- `web/src/routes/modules/create/+page.svelte` (legacy banner only)
- `web/e2e/content-secrets.e2e.ts` (nav label)
- `web/e2e/screenshots.e2e.ts` (home heading)
- `openspec/specs/app-shell/spec.md`

---

### Task 1: Role roster

**Files:** Create `web/src/lib/shangban/roles.ts`, `roles.spec.ts`

**Produces:** `ROLES`, `RoleId`, `roleById`, `rolesByFloor`, `TASK_KIND_BY_ROLE`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ROLES, roleById, rolesByFloor } from './roles';

describe('上班 roles', () => {
	it('lists seven immediately selectable roles across five floors', () => {
		expect(ROLES.map((r) => r.id).sort()).toEqual(
			['ceo', 'courier', 'engineer', 'finance', 'manager', 'sales', 'tech'].sort()
		);
		expect(new Set(ROLES.map((r) => r.floor))).toEqual(new Set([1, 2, 3, 4, 5]));
		expect(ROLES.every((r) => r.selectable === true)).toBe(true);
	});

	it('maps each role to a unique task kind', () => {
		const kinds = ROLES.map((r) => r.kind);
		expect(new Set(kinds).size).toBe(7);
		expect(roleById('courier')?.kind).toBe('sort');
		expect(roleById('sales')?.kind).toBe('negotiate');
		expect(roleById('tech')?.kind).toBe('repair');
		expect(roleById('engineer')?.kind).toBe('ship');
		expect(roleById('finance')?.kind).toBe('audit');
		expect(roleById('manager')?.kind).toBe('allocate');
		expect(roleById('ceo')?.kind).toBe('decide');
	});

	it('covers blue, white, specialist, manager, and CEO looks', () => {
		expect(ROLES.some((r) => r.collar === 'blue')).toBe(true);
		expect(ROLES.some((r) => r.collar === 'white')).toBe(true);
		expect(ROLES.some((r) => r.collar === 'specialist-blue')).toBe(true);
		expect(ROLES.some((r) => r.collar === 'specialist-white')).toBe(true);
		expect(ROLES.some((r) => r.collar === 'manager')).toBe(true);
		expect(ROLES.some((r) => r.collar === 'ceo')).toBe(true);
		expect(rolesByFloor(5).map((r) => r.id).sort()).toEqual(['ceo', 'manager']);
	});
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest --run src/lib/shangban/roles.spec.ts`
- [ ] **Step 3: Implement `roles.ts`** with the seven rows from the spec table (zh-CN names, collar, floor, kind, look hex, blurb).
- [ ] **Step 4: Tests pass**
- [ ] **Step 5: Commit** `test: add 上班 role roster`

---

### Task 2: Floors, stations, pathfind

**Files:** Create `web/src/lib/shangban/floors.ts`, `floors.spec.ts`

**Produces:** `FLOORS`, `COLS=12`, `ROWS=10`, `stationsOn`, `elevatorOf`, `isWalkable`, `pathfind`, `nearStation`

- [ ] Failing tests: five named floors; each has an elevator at the same (x,z); floor 1 has inbound + bays A/B/C; floor 2 negotiation table; floor 3 repair + test benches; floor 4 payroll desk; floor 5 board + CEO office; pathfind around blocked stations; `nearStation` radius 1.4.
- [ ] Implement grid, unique stations, blocked cells (walls + station tiles), 4-neighbour pathfind (copy store `layout.ts` pattern).
- [ ] Commit `feat: add 上班 floor stations and pathfind`

---

### Task 3: Task generation and distinct actions

**Files:** Create `web/src/lib/shangban/tasks.ts`, `tasks.spec.ts`

**Consumes:** roles, floors. **Produces:** `generateTask`, `acceptTask`, `declineTask`, `pickPackage`, `placePackage`, `offerPrice`, `inspectFault`, `choosePart`, `chooseShip`, `judgeClaim`, `moveResource`, `chooseDecision`, `retryTask`, `AUDIT_RULES`, `shouldApproveClaim`

Each kind must have a success test **and** a failure test with different payloads. `generateTask(roleId, rng)` returns the matching `kind`. Queue helpers live in sim (Task 4); this file is pure task math.

Critical assertions:

- sort: matching bay increments `placed`; wrong bay fails the task.
- negotiate: high offer vs low `hiddenMax` burns patience and can fail; fair vs sufficient max succeeds.
- repair: inspect sets `clue`; wrong part fails; correct part completes.
- ship: `ship` on high severity fails; `test` always succeeds; `rewrite` only on `design`.
- audit: meal 90 without exception must be rejected; rejecting a valid receipted 60 meal fails the player.
- allocate: moving staff 3→1 lowers floor 3 staff and raises floor 1; cannot drop a floor below 1 without mishap flag.
- decide: option effects change at least two company meters; picking two different options yields different states.
- retry after fail returns a fresh offered task of the same kind.

- [ ] Red, green, commit `feat: add distinct 上班 task mechanics`

---

### Task 4: World tick, pause, NPCs, role switch

**Files:** Create `web/src/lib/shangban/sim.ts`, `sim.spec.ts`

**Produces:** `createWorld`, `tickWorld`, `stepWorld`, `setPaused`, `setRole`, `startBreak`, `callElevator`, `spawnOffers`

Tests:

- five floors in `company.departments`
- tick 0 has one `courier` offer
- `stepWorld(5000)` still ≤ 8 ticks when unpaused
- `paused` or `hidden: true` ticks 0
- NPC count 10, never above 12; phases include `work` and `break`
- `setRole` to `sales` cancels active courier task, drops `carrying`, expires courier offers, does not move x/z
- after switch, next tick offers a `negotiate` task
- elevator: must be near elevator tile; after `ELEVATOR_TICKS` player.floor changes
- spawn never exceeds 3 live offered+active
- decline then later spawn still works (no deadlock)

- [ ] Red, green, commit `feat: add 上班 world tick and role-switch cleanup`

---

### Task 5: Input helpers

**Files:** Create `web/src/lib/shangban/input.ts`, `input.spec.ts`

**Produces:** `tryMove`, `interact`, `inElevatorZone`

Tests: walk into a blocked station tile is rejected; walk along a path succeeds; interact on inbound with active sort picks a package; interact on matching bay places it.

- [ ] Red, green, commit `feat: add 上班 movement and interact`

---

### Task 6: Save / corrupt recovery

**Files:** Create `web/src/lib/shangban/persist.ts`, `persist.spec.ts`

**Produces:** `SHANGBAN_SAVE_KEY = 'qingxin.shangban'`, `SHANGBAN_SCHEMA = 1`, `readShangbanSave`, `writeShangbanSave`

Tests: round-trip role, floor, pay, active task; `{nope` JSON recovers with `recovered: true` and does not `removeItem` a sibling `qingxin.games.window-garden` key; unknown schema recovers; missing key returns a fresh courier world.

- [ ] Red, green, commit `feat: add versioned 上班 local save`

---

### Task 7: Three.js scene + play chrome

**Files:** Create `render.ts`, `ShangbanPlay.svelte`, `web/src/routes/modules/shangban/+page.svelte`

Follow `store/render.ts`: `mountShangbanScene(canvas)` returns `{ sync, render, resize, dispose, pick, setOverview }` or `null`. Shared geometries. Distinct furniture per floor. Player + NPC people meshes. Elevator car. DPR cap. Reduced motion skips bob. Dispose everything.

Play chrome: `qx-glass` header (返回模块, clock, pay, 暂停, 换岗) and dock below canvas. Canvas `aria-label="轻心大厦"`. `data-ready`, `data-floor`, `data-role`, `data-task`, `data-npcs`. Live region for `notice`. WebGL fail → DOM floor buttons + station list + same task actions. Hidden tab pauses. Role sheet lists all seven roles as buttons.

No ready-state injector in the public UI. Optional `window.__qingxinShangban` **only** when `window.__qingxinE2E` is set, exposing `getState()` for asserts — not a complete-task cheat.

- [x] Implement, `npm run check` clean for these files
- [x] Commit `feat: add 上班 Three.js building and glass play view`

---

### Task 8: Replace 内容创作 entry, keep legacy studio

**Files:** `modules.ts`, `nav.ts`, `AppShell.svelte`, `+page.svelte` (home), `modules/+page.svelte`, `[slug]/+page.ts`, `create/+page.svelte`, specs, e2e copy that names the **nav/home** entry.

- MODULES: replace `create` row with `shangban` / 上班. Do not delete the create route.
- TABS: `/modules/shangban`, label 上班, icon briefcase. `isTabActive` treats shangban like create was (not the 模块 tab).
- AppShell `playView` includes `/modules/shangban`.
- Home card: five floor names, 去上班, no platform grid.
- Hub blurb: 上班是主产品场景。秘密信箱单独收信。
- Create page: banner + link 去上班, heading 内容创作 still present for legacy tests.
- `modules.spec.ts` / `nav.spec.ts` / `content-secrets` nav test / home screenshot assertions updated.
- OpenSpec app-shell delta + living spec: hub lists 上班 instead of 内容创作 as the primary module; `/modules/create` remains a legacy studio.

- [x] Tests red then green
- [x] Commit `feat: replace 内容创作 nav with 上班 and keep legacy studio`

---

### Task 9: Playwright natural play, screenshots, recording

**Files:** `web/e2e/shangban.e2e.ts`; screenshot paths under `web/screenshots/`

Guest (no session). Do not write a finished save in `addInitScript`.

Cover: move, elevator, courier complete, switch sales complete, switch manager then CEO different UI, decline, fail+retry, recurring second task, reload persistence, 390 dock vs station overlap, 390/1280 light/dark screenshots, video.

Regression: existing `games.e2e.ts` store/garden smoke still pass (run those files).

- [x] Commit `test: add 上班 natural-play e2e`

---

### Task 10: OpenSpec + inline review + verify

Hand-write `openspec/changes/shangban-stage1/{proposal,design,tasks}.md` and specs `shangban`, `app-shell`. CLI is absent.

Inline CE/ECC/ponytail/Hallmark-anti-slop pass on the play surface: concrete zh-CN, no journey copy, no extra button row, no claimed-but-locked roles.

`npm run check`, `npm test`, `npm run lint`, `npm run build`, Playwright files above.

- [x] Commit remaining docs if needed

## Execution note (2026-11-16)

Tasks 1–10 executed inline on `cursor/shangban-stage1-4e4e`. Commits are grouped rather than one-per-task. Playwright natural guest play, 390/1280 light/dark screenshots, and a real gameplay recording passed without injected finished state. `npm run check` 0 errors; Vitest 343 passed; `npm run build` succeeded. Repo-wide `prettier --check .` still fails on 39 pre-existing files not touched here. Stage 2/3 remain roadmap.

## Stage 2 roadmap (not this PR)

- Named NPCs with schedules that the player can greet; tiny favor/memory flags.
- Cross-floor events: a failed repair creates a sales complaint; a hire on floor 4 lowers floor 3 workload next day.
- 客服专员 / 人事专员 as extra roles with their own kinds (`complaint`, `hire`).
- Break room conversations. Still no backend.

## Stage 3 roadmap (not this PR)

- Career history log, optional titles that change look but never gate roles.
- Visual polish: interior lighting per floor, more prop variation, nicer elevator doors.
- Performance pass if measured FPS on 390 is weak (instancing, fewer shadow casters).

## Plan self-review

Spec coverage: floors, seven roles, distinct kinds, offers/queue, elevator, NPC/break/clock/pause, save, nav replacement, legacy create, a11y/DPR/WebGL fallback, tests, Stage 2/3 — each maps to a task. No TBD. Types: `RoleId`, `TaskKind`, `FloorId` stay consistent across tasks.
