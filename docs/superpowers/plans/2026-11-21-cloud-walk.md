# 云上散步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; no reviewer fanout). Do **not** start this plan until 潮汐呼吸 is verified on PR 37.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Ship 云上散步 as a guest-playable Three.js sky-island wander: wind currents, bouncing clouds, sky creatures, weather fragments that retint the sky and grow a cloud garden.

**Architecture:** Same game folder pattern as tide: `web/src/lib/games/cloud/sim.ts`, `persist.ts`, `render.ts`, `CloudPlay.svelte`. Catalog `cloud-walk` → `playable`, CTA 开始散步. Memory-shelf stays coming unless already shipped.

**Tech Stack:** SvelteKit 3, TS, Vitest, Playwright, existing `three`. No paid assets.

**Spec:** `docs/superpowers/specs/2026-11-21-cloud-walk-design.md`

## Global constraints

Same as tide: PR 37, no merge/Mac, guest, theme key untouched, play-view nebula skip, audio gesture, hidden-tab pause, dispose, DPR/particle caps, zh-CN, TDD, genuine Playwright.

## File map

Create `web/src/lib/games/cloud/{sim,sim.spec,persist,persist.spec,render,CloudPlay.svelte,audio}.ts(x)` and `web/e2e/cloud-walk.e2e.ts`. Modify catalog + play dispatcher. Save key `qingxin.games.cloud-walk`.

### Task 1: Sim TDD

`createSky`, `stepSky`, `moveWalker`, `enterWind`, `bounceCloud`, `collectFragment`. Fragments `{sun,rain,breeze,night}` change `skyMode` and unlock garden slots. No timer fail.

### Task 2: Catalog + mount

`status: 'playable'`, `playCta: '开始散步'`. Play page mounts CloudPlay.

### Task 3: Fancy Three scene

Multiple island meshes, translucent cloud slabs, wind tubes, 3 creature types, garden isle that grows, cinematic sky. Low-detail / reduced-motion variants.

### Task 4–5: E2E + check/unit/build

Genuine wander to a fragment, sky dataset changes, garden plant appears, reload persists, 390/1280, recording.

Remaining after this plan: 记忆货架 only (if tide already shipped).
