# Change: Move 上班 into Games

Relocate the existing workday sim into the games catalog. Not Stage 2/3, not a new game.

## Why

上班 should appear as a playable catalog game and no longer as a separate top-level hub module.

## What

- Catalog id `shangban`, title 上班, category 经营, play CTA 开始上班.
- Canonical play `/modules/games/shangban/play`; detail `/modules/games/shangban`.
- `/modules/shangban` 301-redirects to catalog play.
- Same Three.js loop, `qingxin.shangban` schema 2, and unstick repairs.
- Hub tile removed. Home 去上班 remains a shortcut through the legacy URL.
- Play chrome: immersive shell, 返回目录 to `/modules/games`.

## Out of scope

New games, store/tide/cloud/shelf designs, Stage 2/3, auth/DB/theme, merge/Mac.
