# 记忆货架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; no reviewer fanout). Do **not** start until 潮汐呼吸 is verified; coordinate with 云上散步 if that follow-up is in flight.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Ship 记忆货架 as a guest-playable Three.js study: pick up/inspect props, remember rearrangements, solve harder shelves, decorate a collection room.

**Architecture:** `web/src/lib/games/shelf/{sim,persist,render,ShelfPlay.svelte}`. Catalog `memory-shelf` → `playable`, CTA 开始整理. Save `qingxin.games.memory-shelf`.

**Tech Stack:** Existing three + canvas textures for book spines / labels. No paid scans.

**Spec:** `docs/superpowers/specs/2026-11-21-memory-shelf-design.md`

## Global constraints

Same Qingxin PR 37 rules as tide. No 2D emoji match-3. Inspect must be 3D. Reduced-motion: no camera shake, still pickable.

## File map

Create shelf sim (layouts, scramble, restore, inspect state), persist (puzzle index + collection placements), render (study + collection room cameras), ShelfPlay chrome, `web/e2e/memory-shelf.e2e.ts`.

### Task 1: Sim TDD

`createStudy`, `scrambleShelf`, `pickObject`, `placeObject`, `isShelfRestored`, `unlockCollection`. Increasing slot counts. Hint optional. No timer fail.

### Task 2: Catalog + mount

Playable CTA 开始整理. Dispatcher mounts ShelfPlay.

### Task 3: Fancy study

Many distinct props, warm lighting, pick-up offset in front of camera, collection room. Low-detail reduces ornament count.

### Task 4–5: Genuine e2e inspect + restore one shelf + collection + reload; check/unit/build.

Remaining after this plan: none of the Nov 21 three-game set.
