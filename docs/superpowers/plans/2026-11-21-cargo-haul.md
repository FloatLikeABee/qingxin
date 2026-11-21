# 重卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans inline; no reviewer fanout.

**Goal:** Playable endless heavy-truck drive on a connected recycled road graph (highway / city / country) with real steer/throttle/brake/reverse. Approach B from the approved spec.

**Stack on** shelf PR #43 from SHA ee530936. No Mac/merge/main/DB. Not Annual Report / Operation R.

## File map

- Add `web/src/lib/games/cargo/{sim,persist,render,audio,CargoPlay.svelte}` + specs
- Modify catalog, GameCover (truck motif), games page 驾驶 tile, play switch, games e2e
- Add `web/e2e/cargo-haul.e2e.ts`
- Update OpenSpec `openspec/changes/cargo-haul-game/`

## Tasks

1. TDD sim: connected graph, turn radius, handling, reverse, recycle pools after 50 km generation, recover keeps odometer.
2. TDD persist schema 1, corrupt/foreign without wiping other qingxin keys.
3. Three.js truck + wide roads + biome scenery, chase camera, dummy cars.
4. Play chrome 1280/390, 44px 油门/刹车/倒车, pause without sticky hidden-tab, audio opt-in.
5. Natural Playwright drive: speed/yaw, junction turn, biome change, reverse, recover, reload, mobile + catalog smoke.
6. check / full unit / build / e2e, stacked PR, STOP.
