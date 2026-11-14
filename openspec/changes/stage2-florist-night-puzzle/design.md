# Design

## Context

Play routes already exist for every `playable` registry id. `play/+page.svelte` currently always mounts 便利店经理. Detail CTA copy is hardcoded 开始经营.

## Decisions

- Keep the in-memory `GAMES` registry. Add `playCta` so detail/play labels fit each game (开始经营 / 开始配花 / 开始拼夜).
- Dispatch play by `game.id`. Store game stays Three.js; the two new games are DOM/SVG (no extra WebGL). Simulation stays pure TypeScript.
- **街角花店:** two phases — 配橱窗 then 开门. Stems have mood 暖/静/亮, color, freshness. Window holds three bouquets. Customers ask for a mood (and sometimes a named flower). Score from mood match, preferred stem, freshness. Day ends after a handful of guests.
- **夜窗拼图:** 4×3 window of night shards (moon, stars, cloud, towers, windows, street). Tap a tray shard then a slot (touch-first). Correct placement lights that region; wrong placement counts a miss. Wind may reshuffle the tray, never placed shards. Completing the window plays a settle moment.
- localStorage keys: `qingxin.games.corner-florist`, `qingxin.games.night-puzzle`.
- Remaining coming games unchanged. 便利店经理 untouched except the play dispatcher wrapping it.

## Risks

- Detail CTA and e2e still assumed a single playable game and 即将到来 on 夜窗拼图 — tests must move the coming-soon case to 潮汐呼吸.
- 390-wide: florist window + buckets must scroll, not shrink below 44px controls.
