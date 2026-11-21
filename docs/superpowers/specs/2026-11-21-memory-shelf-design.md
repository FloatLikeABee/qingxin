# 记忆货架 (approved 2026-11-21)

Ge approved: **Build all three as designed, with fancy Three.js visuals and real gameplay.** This spec is independently deliverable. **Do not implement until 潮汐呼吸 is verified; 云上散步 may precede or follow in later follow-ups.** Until then the catalog stays `coming` with honest copy.

**Richly detailed magical study; objects pick up/inspect; remember changing arrangements; solve increasingly intricate shelf puzzles; decorate a free-play collection room.**

Workstream: same PR 37 / `cursor/shangban-stage1-4e4e`. No merge/deploy/Mac.

## Player fantasy

A warm, cluttered, magical study. You pick up a globe, a tea cup, a stuffed moth, inspect them close. Shelves rearrange. You remember what moved and put things back — puzzles get more intricate. Solved objects unlock a collection room you decorate freely.

If shelves are a 2D memory-match grid with emoji, it failed. If objects cannot be picked up and inspected in 3D, it failed.

## Catalog honesty until built

Keep `memory-shelf` status `coming`, CTA 即将到来. Do not claim playable.

## Approved loop (when implemented)

1. Play route `/modules/games/memory-shelf/play`.
2. Study scene with many distinct props (books, bottles, lamps, plants, instruments) using original/procedural meshes and canvas textures — not a row of cubes.
3. Click/tap to pick up, orbit inspect, place. Puzzle: watch a rearrangement, restore the prior layout. Difficulty: more slots, more movers, brief occlusions. No timer fail; optional hint.
4. Completing a shelf unlocks the object into a **collection room** (separate camera/area) for free decoration.
5. Save key `qingxin.games.memory-shelf`: puzzle index, collection placements, settings.
6. Chrome-glass collapsible dock, return, pause, reduced-motion (no camera shake; still inspectable), low-detail, audio opt-in.

## Preserve / verify later

Genuine Playwright: inspect an object, complete at least one shelf from live play, collection room gains the object, reload persists. 390/1280. No seeded solved save as only evidence.

## Out of scope until its follow-up

Playable route, study scene, or status `playable`.
