# 云上散步 (approved 2026-11-21)

Ge approved: **Build all three as designed, with fancy Three.js visuals and real gameplay.** This spec is independently deliverable. **Do not implement until the 潮汐呼吸 playable commit is verified.** Until then the catalog stays `coming` with honest copy.

**Explore floating islands, ride wind currents, bounce across clouds, discover little sky creatures; collect weather fragments to change the sky and grow your own cloud garden.**

Workstream: same PR 37 / `cursor/shangban-stage1-4e4e`. No merge/deploy/Mac. Parent auto-syncs later.

## Player fantasy

You walk a soft path between floating isles in a huge sky. Wind currents lift you. Clouds bounce. Tiny sky creatures hide and reveal. Weather fragments tint the sky and grow a personal cloud garden. No score pressure, no timer.

If this ships as a scrolling 2D sprite or a single box on a gradient, it failed. If there is nothing to collect or grow, it failed.

## Catalog honesty until built

Keep `cloud-walk` status `coming`, CTA 即将到来. About copy may describe the approved fantasy but must not claim it is playable.

## Approved loop (when implemented)

1. Play route `/modules/games/cloud-walk/play` (isPlayView already skips nebula).
2. Third-person-ish wander on islands; pointer/keyboard/touch. Ride visible wind tubes. Bounce on cloud meshes. Discover 3+ distinct sky creatures.
3. Collect weather fragments (sun/rain/breeze/night). Each fragment changes sky lighting/fog/cloud tint and adds a plant to the cloud garden isle.
4. Saved progress: visited isles, fragments, garden plants, settings. Guest, local key `qingxin.games.cloud-walk`.
5. Chrome-glass collapsible dock, return link, pause, reduced-motion, low-detail, audio opt-in after gesture.
6. Fancy Three.js: layered cloud volumes or stacked translucent meshes, island rock+grass+homes, wind streaks, creatures with unique silhouettes, cinematic lighting. Procedural/original only.

## Preserve / verify later

Same global Qingxin rules as 潮汐呼吸. Playwright genuine wander + collect + sky change + reload; 390/1280; no seeded complete save as only evidence.

## Out of scope until its follow-up

Any playable route, Three scene, or fake “almost ready” CTA.
