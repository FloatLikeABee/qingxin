# Endless games replacement (approved 2026-11-14)

Ge played 街角花店 and 夜窗拼图 on PR 36 and said neither is fun. They approved this replacement in full: **Yes, build both games with this design.**

This spec is the product contract. No further approval pause.

## Product face

Qingxin web app, zh-CN, guest play, frontend-only. Same catalog already shipped: card → detail → Play. Optional localStorage. Mouse + touch. Light/dark. Paler sky / Qingxin blue `#3B82F6` / `#60A5FA` with coral / teal / gold. Bento for card-like chrome; play surfaces stay uncluttered and game-first. Not a Hallmark catalog theme. Not sample-slide purple.

Keep **便利店经理** and Stage 1 Content / Secrets. 潮汐呼吸, 云上散步, 记忆货架 stay 即将到来. No backend, no game account, no native app, no merge, no deploy, no second PR.

Desktop **and** 390px touch must actually play. No `touchmove` / `preventDefault` on `window` or `document` — only the playfield uses `touch-action: none`. Pause when the tab is hidden. Resume / restart. Lifecycle cleanup. Bound entity counts for endless loops.

In-game biology is simplified gameplay, not gardening advice. Show a one-line disclaimer on the garden play HUD.

## Game 1 — 晴空出击 (replaces 夜窗拼图)

| Field | Value |
| --- | --- |
| id | `sky-sortie` |
| title | 晴空出击 |
| englishTitle | Azure Sortie |
| category | 飞行 (new catalog category) |
| tags | 战机, 无尽 |
| playCta | 开始出击 |
| summary | 在淡蓝天空里躲开弹雨，打完一波还有下一波。 |
| cover motif | `jet` — pale sky, Qingxin-blue jet, coral/gold tracers |

**Loop.** Side-view 2D flight, player near the bottom. Automatic fire. Keyboard (WASD / arrows) or pointer/touch on the playfield to steer. Exactly **3 lives**. Hit → lose one life, brief invulnerability with a visible flash, continue. Distinct enemies with distinct scores. Avoidable obstacles that damage on contact. Recurring bosses with telegraph then a distinct attack. Waves get harder while lives remain. Endless enemy supply until game over. Overlay: score, best, 重新开始.

**Feel.** Responsive steering, fair hitboxes (player hurtbox smaller than art), legible enemy/projectile silhouettes, telegraphed bosses, satisfying +score pops. Best score in `qingxin.games.sky-sortie`.

**Compatibility.** `/modules/games/night-puzzle` and `.../play` redirect to `sky-sortie`. No puzzle labels anywhere on the new face.

**Tech.** Pure TypeScript sim + Canvas 2D draw. No Three.js. Logic unit-tested without canvas.

## Game 2 — 窗前庭园 (replaces 街角花店)

| Field | Value |
| --- | --- |
| id | `window-garden` |
| title | 窗前庭园 |
| englishTitle | Window Garden |
| category | 经营 |
| tags | 种植, 虫鸣 |
| playCta | 开始种植 |
| summary | 把四十多种植物养熟，认出益虫和害虫。园子没有通关。 |
| cover motif | `garden` — beds, mixed silhouettes, coral/teal/gold blooms |

**Loop.** 12 planting beds. At least **40 genuinely distinct** plant types: unique id, Chinese name, silhouette, palette, water / light / nutrient needs, growth stages, harvest value, seed cost, unlock. Tools: watering can, fertilizer, shade cloth. Inspect bugs: pests damage plants; pollinators speed bloom; predators eat pests. Catch pests; leave/protect beneficials. Mistaken catch of a beneficial is called out and costs a small fee. Harvest funds seeds and supplies. No final level.

**Economy / recovery.** Starting seeds and water so the first minutes work. If coins, seeds, and living plants are all gone, **空园补给** grants a starter seed and water refill (always available in that dead-end). Never a hard lock.

**Save.** `qingxin.games.window-garden` schema version 1. Validate types, bed count, plant ids, clamp numbers. Corrupt or unknown schema → fresh garden plus a recovered flag. Guest play.

**Compatibility.** `/modules/games/corner-florist` and `.../play` redirect to `window-garden`. No florist/bouquet/window-shop copy on the new face.

**Tech.** Pure TypeScript sim + DOM/SVG plant art. No WebGL. Logic unit-tested without the DOM.

## Shared catalog

Three playable ids: `convenient-store`, `window-garden`, `sky-sortie`. Featured remains 便利店经理. Hero line becomes catalog-wide, not store-only. Category tiles add 飞行. Covers for the two replacements change with the new motifs.

## Self-review (contradictions)

| Tension | Resolution |
| --- | --- |
| Endless shooter vs exactly 3 lives | Waves and enemies are endless **while lives remain**. Three hits (outside invuln) end the run. |
| Endless garden vs seed unlocks | Unlocks expand the nursery. There is no win screen and no last plant that finishes the game. |
| Spend-down economy vs “no deadlock” | 空园补给 is a recovery action when supplies and plants are gone. |
| Playwright “move/fire” vs auto-fire | Fire is automatic. E2E asserts bullets exist after the player is in play; the player only steers. |
| Boss / 3-life coverage vs “no test cheats in UI” | Full progression is in Vitest with a seeded sim. Playwright drives the real canvas (steer into a wreck three times; wait for the first boss). No debug buttons, no query-param god mode. |
| Hallmark “all colours through tokens” vs sprite palettes | Chrome uses Qingxin tokens. Plant/enemy palettes are game content data. Canvas reads `--qx-*` for sky/HUD. |
| Impeccable PRODUCT.md missing | Scoped replacement inside the shipped Qingxin games module. Do not write PRODUCT.md. Do not run concept-seed. |
| Pause-on-hidden vs endless | `document.visibilityState` pauses the tick; resume continues the same run. |
| Old ids in prerender | Alias ids stay in `entries()` so static adapter emits redirect pages. |
| 益智 leftover on 夜窗拼图 | Category becomes 飞行. Search for 拼图 / 夜窗 must not be the product title. |
| Garden “40 plants” vs shared art | Each plant has a unique `form` key used by PlantView. Tests fail if two plants share id, name, or form. |

## Out of scope

iOS/native, server save, accounts, other 即将到来 games, restyling AppShell, Hallmark branding, merging PR 36, deploying, touching a Mac.
