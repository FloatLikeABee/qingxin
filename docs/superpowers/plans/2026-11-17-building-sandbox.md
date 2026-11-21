# 积木台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; no reviewer fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Add a guest-playable Three.js construction sandbox (积木台) with five-piece batches, and retire visible surfaces for 本地生活 / AI效率工具箱 / 学习打卡 / 求职副业, on the existing PR 37 branch.

**Architecture:** Pure TypeScript world in `web/src/lib/jimutai/{pieces,world,input,persist}.ts`; Three.js only in `render.ts`; Svelte chrome in `JimutaiPlay.svelte`. Retired routes render `RetiredNotice` or 302 without importing those modules' interactive UI. Archival `lib/local|study|hustle|tools` and API helpers stay.

**Tech Stack:** SvelteKit 3, TypeScript strict, Vitest, Playwright, Three.js 0.187 already in `web/package.json`. No new dependencies.

## Global Constraints

- Same branch/PR as 上班 Stage 1: `cursor/shangban-stage1-4e4e`. Do not open a competing PR. Do not merge.
- Guest play. No AI, backend, or login for 积木台.
- zh-CN. Qingxin blue `#3B82F6` / `#60A5FA`, sky / coral / teal / gold. Existing `.qx-glass`.
- Save key `qingxin.jimutai` schema 1. Corrupt recovery must not delete other keys.
- Start with five pieces; refill five only when the tray is empty after those five are placed.
- Scene primary; compact dock; 390 targets reachable; no fake FPS; no test controls in the UI.
- Preserve 上班, Secrets, garden/store/shooter, create drafts, and archival data for the four retired modules.
- Bounds 16×16×12 and 80 placed pieces. Copy must not say 无限.

## File map

Create:

- `web/src/lib/jimutai/pieces.ts` + `pieces.spec.ts`
- `web/src/lib/jimutai/world.ts` + `world.spec.ts`
- `web/src/lib/jimutai/input.ts` + `input.spec.ts`
- `web/src/lib/jimutai/persist.ts` + `persist.spec.ts`
- `web/src/lib/jimutai/render.ts`
- `web/src/lib/jimutai/JimutaiPlay.svelte`
- `web/src/routes/modules/jimutai/+page.svelte`
- `web/src/lib/retired/catalog.ts` + `catalog.spec.ts`
- `web/src/lib/retired/RetiredNotice.svelte`
- `web/src/routes/study/+layout.ts`
- `web/e2e/jimutai.e2e.ts`
- OpenSpec `openspec/changes/jimutai-sandbox/**`
- This spec/plan pair

Modify:

- `web/src/lib/modules.ts`, `modules.spec.ts`
- `web/src/lib/nav.spec.ts`
- `web/src/lib/components/AppShell.svelte`
- `web/src/lib/components/Icon.svelte` (blocks glyph)
- `web/src/routes/+page.svelte`
- `web/src/routes/modules/+page.svelte`
- `web/src/routes/modules/[slug]/+page.ts`
- `web/src/routes/modules/{local,ai,hustle}/+page.svelte`
- `web/src/routes/modules/study/+page.ts` / `+page.svelte`
- `web/src/routes/pets/services/+page.svelte`, `web/src/lib/pets/disclaimer.ts` + spec
- `web/e2e/screenshots.e2e.ts`, `shell.e2e.ts`, `shangban.e2e.ts`, `api.e2e.ts`, `pets-study.e2e.ts`
- `openspec/specs/app-shell/spec.md`

---

### Task 1: Pieces, occupancy, batches

**Files:** `web/src/lib/jimutai/pieces.ts`, `pieces.spec.ts`

- [ ] Write failing tests for six small shapes, yaw/tilt, bounds, batch of five always containing 方块
- [ ] Run tests, confirm RED
- [ ] Implement `SHAPES`, `worldCells`, `inBounds`, `makeBatch`
- [ ] Run tests GREEN

### Task 2: World inventory, place, undo across refill

**Files:** `web/src/lib/jimutai/world.ts`, `world.spec.ts`

- [ ] Write failing tests: five start; no refill after one place; refill only after fifth; invalid overlap does not consume; undo across refill restores tray/batch; cap 80
- [ ] Run RED, implement `createWorld` / `placeAt` / `undoLast` / `rotateSelected` / `resetWorld`, GREEN

### Task 3: Persist + gestures

**Files:** `persist.ts`, `persist.spec.ts`, `input.ts`, `input.spec.ts`

- [ ] Round-trip tray/placed/camera/undo; corrupt JSON leaves sibling saves; tap vs orbit threshold 10px
- [ ] RED then GREEN

### Task 4: Three.js play view

**Files:** `render.ts`, `JimutaiPlay.svelte`, route, AppShell playView, modules catalog, home card, icon

- [ ] Scene-first table, ghost, orbit/pan/zoom, glass tray dock, WebGL 2D fallback, confirm reset, E2E hook only when `__qingxinE2E`

### Task 5: Retire four modules

**Files:** retired notice, replace local/ai/hustle/study surfaces, pets CTA, hub/home/screenshots/shell tests, app-shell spec

- [ ] No catalog cards, no home 求职概览, deep links show notice or redirect, archival libs untouched

### Task 6: Verify

- [ ] Unit tests, `check`, lint on touched files, build
- [ ] Playwright: two batches by pointer, refill only after fifth, undo across refill, reload, orbit does not place, overlap does not consume, cancel reset, 390/1280 light/dark of a built structure, short video
- [ ] 上班 smoke still passes; garden/store/shooter untouched
