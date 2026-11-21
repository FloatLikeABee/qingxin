# Haunted bookshelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; no reviewer fanout).

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Replace the memory-shelf veil puzzle with one fancy 3D bookcase: free rearrange, one haunted book per round, ghost pops out, cries, says 对不起！, returns; next round random haunt; old save migrates.

**Architecture:** Keep `web/src/lib/games/shelf/{sim,persist,render,audio,ShelfPlay.svelte}`. Rewrite sim/render/play. Catalog id `memory-shelf`, CTA 开始整理, card art unchanged; about copy tells the new loop.

**Tech Stack:** Existing Three.js ^0.187, canvas spine textures, chrome-glass dock.

**Spec:** `docs/superpowers/specs/2026-11-21-haunted-shelf-design.md`

## Global Constraints

- Guest/offline local only. No Mac/merge/main/DB.
- Stack on cloud PR #42 from SHA a2b683c.
- No PRODUCT.md / impeccable init (approved brief is enough).
- Do not implement truck / Annual Report / Operation R.

## File map

- Modify: `sim.ts`, `sim.spec.ts`, `persist.ts`, `persist.spec.ts`, `render.ts`, `ShelfPlay.svelte`, `audio.ts`, `catalog.ts`, `catalog.spec.ts`, `e2e/memory-shelf.e2e.ts`, `e2e/games.e2e.ts`
- Add: OpenSpec `openspec/changes/haunted-shelf/`

## Tasks

1. TDD sim: layout, pick/place swap, one haunt, sequence phases, no retrigger, nextRound, pause, reduced-motion still hits sorry.
2. TDD persist schema 2 + schema 1 settings migrate without wiping other keys.
3. Three.js bookcase + ghost + hit/project.
4. Play chrome: canvas pick/place, overlay 对不起！, 下一轮 after done, audio opt-in.
5. E2E natural pick/place + haunt phases 1280/390 + reload + catalog regression store/tide/cloud/shangban.
6. check/unit/build/e2e, stacked PR, STOP.
