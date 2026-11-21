# 云上散步 Approach A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; no reviewer fanout).

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Replace the four-island hop with a bounded ghost 6DOF sandbox (R=42, Y −14..18) and four enterable biomes, migrating schema 1 without wipes.

**Architecture:** Same files: `sim.ts` (6DOF + biomes + bound), `persist.ts` schema 2, `render.ts` ghost + biome kits + occlusion, `CloudPlay.svelte` 飞升/潜入. Catalog cover unchanged; about/dock copy 游魂、飞、潜.

**Tech Stack:** SvelteKit 3, TS, Vitest, Playwright, existing `three`.

## Global Constraints

Approved Approach A only. No jump. No gates/timers/combat. Guest local save. Theme and other game keys untouched. 390/1280. Audio gesture. Hidden-tab pause. TDD. Genuine Playwright fly/dive, not teleports. CE/ECC not installed. modern-web-guidance: pause control, reduced-motion, 44px touch; do not use volatile canvas-html or scroll-axis-lock.

## File map

- Modify: `web/src/lib/games/cloud/{sim,sim.spec,persist,persist.spec,render,CloudPlay.svelte}.ts`
- Modify: `web/e2e/cloud-walk.e2e.ts`, `web/src/lib/games/catalog.ts`
- Create: OpenSpec `openspec/changes/cloud-sandbox/`

### Task 1: Sim TDD — 6DOF, biomes, bound, home recall

- [x] Done

### Task 2: Persist schema 2 migration from schema 1

- [x] Done

### Task 3: Ghost + biomes render, occlusion, 3D hit, LOD

- [x] Done

### Task 4: CloudPlay 飞升/潜入, datasets, copy; catalog about

- [x] Done

### Task 5: Playwright genuine climb/dive/roam/edge/reload + 390

- [x] Done

Self-review: spec biomes, ghost, schema 2, no jump, fragments optional — each has a task.
