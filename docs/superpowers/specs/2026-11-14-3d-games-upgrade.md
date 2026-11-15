# 3D garden + store upgrade (approved 2026-11-14)

Ge asked for better, more realistic Window Garden and Convenient Store UI, still in the existing Three.js style. They approved this design in full: **Yes, build both upgrades with this design.**

No further approval pause. Same PR 36 / `cursor/stage2-games-catalog-e526` from `c358d29`. Do not merge, deploy, or touch the Mac. Leave **晴空出击** unchanged. Stage 1 Content/Secrets intact. 潮汐呼吸 / 云上散步 / 记忆货架 stay 即将到来.

## Product face

Qingxin web app, zh-CN, guest play, frontend-only. Catalog path unchanged. Light/dark. Paler sky / Qingxin blue `#3B82F6` / `#60A5FA` with coral / teal / gold. Bento only for card-like chrome; **the play scene dominates**. Not Hallmark branding. Not sample-slide purple.

Desktop **and** 390px touch must actually play. `touch-action: none` only on the playfield. Pause when the tab is hidden (`visibilitychange` / `document.hidden`). Resume / restart. Dispose WebGL on unmount. Bound entity counts. Keyboard and a real DOM equivalent for every scene-only choice. No hover-only tooltips. Touch targets ≥ 44px.

WebGL failure: a written explanation **and** an interactive DOM fallback (shelf buttons / bed list). Never silently swap in a static screenshot.

In-game biology is simplified gameplay, not gardening advice. Keep the one-line garden disclaimer.

## Window Garden — Three.js window sill

Upgrade the current DOM/SVG beds into an actual Three.js indoor window garden: sill, pots, sky through the pane, soft lighting and shadows, gentle sway. Stylized, readable, not photoreal, not primitive blocks with UI pasted over.

### Plants

Expand **42 → at least 60** distinct species. Keep every existing plant **id** so `c358d29` saves migrate without losing plants, coins, harvests, or seeds.

Each species has a unique id, Chinese name, water/light/nutrient needs, growth stages, harvest/seed economy, **and a unique morphology recipe** (`family` + leaf shape + bloom/fruit kind + stem count + height + leaf count). Families: herb, leafy, flower, vine, fruiting, rosette, tree, succulent, grass, aquatic. Species MUST NOT be the same mesh with a tint swap. Tests assert unique morphology signatures and that each family has a distinct builder path.

Visible stages: seed, sprout, leaf, bud, bloom, ripe, wilt. Need/damage/recovery readable on the plant (droop, pale leaf, pest chew, recovery bounce).

### Bugs

Kinds: 蚜虫, 蜗牛, 毛虫 (harmful); 蜜蜂, 蝴蝶, 瓢虫 (helpful). Snails stay. Bugs **arrive, visit a plant, move to another, and leave**. Cadence high enough that a normal play session sees an insect without waiting minutes. Cap living bugs (8). Protect pollinators and predators; remove pests. Inspect UI names the insect and its role. Touch targets on inspect/remove are large. Arrival/departure is animated in the scene.

### Activities

Tap a pot in the scene (or its DOM twin) → needs copy + **large contextual actions**: 浇水, 施肥, 修剪, 换盆, 收获, 捉虫 / 留下益虫.

| Action | Rule (must have feedback, not decorative) |
| --- | --- |
| 浇水 / 施肥 / 遮荫 | existing care; still the growth matcher |
| 修剪 | only leaf / bud / bloom. Restores 1 health and advances progress. Pruning again too soon delays bloom. Too-young plants refuse with a notice. |
| 换盆 | costs 6 coins, once per plant (`potSize` 1→2). Adds nutrient and a harvest bonus. Already-large pots refuse. |
| 收获 | ripe only; potSize 2 pays extra. Funds seeds/supplies. No final level. |
| 捉虫 | pests pay a coin; beneficials scold and cost coins. |

Seed browser: pictured, filterable by family (叶菜 / 香草 / 花卉 / 果蔬 / 树木 / 多肉 / 水生), not a giant unlabeled button dump.

Economy / 空园补给 deadlock recovery stays.

### Save

`qingxin.games.window-garden` schema **2**. Schema **1** (c358d29) MUST load: plants, stages, coins, harvests, seeds preserved; new fields default (`potSize: 1`, empty world-bug list). Corrupt JSON still recovers a usable garden. Guest only.

### UI chrome

Scene fills the play surface. HUD: coins, water, fertilizer, pause, restart, 返回目录. Contextual dock under the scene, not covering pots. Filterable seed sheet. Keyboard: arrows/number keys select pots; keys for water/feed/prune/repot/harvest. `document.hidden` pauses.

## Convenient Store — Three.js polish (sim intact)

Do **not** change restock math, shopper phases, scoring, day length, or SKU economy. Improve the existing Three.js store:

- Shelves with individually recognizable packaging (canvas labels: 水 / 吐司 / 奶 / 零食 / 便当).
- Glass refrigerators for milk; checkout with register, bag, queue mark.
- Environmental lighting (window, ceiling, warm pendant) + soft shadows.
- Shoppers: walk bob, reach-to-pick, pay-at-counter, leave with bag. Actions readable at 390.
- Direct shelf pick + **low-stock / restock** indicators in the scene (coral pad) and HUD.
- Large contextual 从库房补货. Concise guidance. Cash / stock / status readable.
- Camera/frustum must keep shelves visible; HUD must not bury pick targets.
- Pause on hidden tab (missing today). Keyboard: 1–5 select shelf, R restock.
- WebGL fail: explanation + existing shelf buttons still work.

## Shared constraints

- No backend, no game account, no native app.
- No new npm dependencies.
- Shooter tests remain green; do not edit `web/src/lib/games/shooter/**`.
- Test-only seeded demo (`window.__qingxinGardenTest`) only when Playwright sets `window.__qingxinE2E`. No cheat buttons in normal UI.
- Mobile performance: reuse geometries, cap pixel ratio (1.5 on small screens), shadow map 1024, rebuild plant meshes only when stage/id changes.

## Self-review (contradictions)

| Tension | Resolution |
| --- | --- |
| 60 plants vs mobile GPU | Shared unit geometries; per-pot groups rebuilt on change only; 12 pots not 60 in the scene at once. |
| Schema 2 vs “don’t lose c358d29 plants” | Accept schema 1 and 2; only unknown schema / corrupt JSON resets. |
| Bugs “come and go” vs bed.bugs array | World list with arrive/visit/leave; visiting bugs still attach to the bed for care logic. |
| Store “more realistic” vs intact sim | Render + HUD only. `sim.ts` / `goods.ts` / `layout.ts` gameplay stay. |
| DOM fallback vs “no static screenshot” | Fallback is interactive beds/shelves, not an image. |
| Impeccable PRODUCT.md missing | Scoped upgrade of shipped games. Do not write PRODUCT.md. Do not concept-seed. |
| Hallmark token colours vs Three.js paints | Chrome uses `--qx-*`. Scene paints are game content (wood, leaves, SKUs). |
| Pause-on-hidden vs endless garden | Tick pauses; the same garden resumes. |
| content-visibility pause vs fullscreen play | Play is the viewport. Use `document.hidden` (specified) plus RAF cancel on unmount. |
| Prune/repot “must mean something” | Both have refuse paths and numeric effects (health/progress/coins/harvest). |
| Seed browser vs 60 buttons | Family filters + pictured tiles; unlocked subset only. |

## Skills used for this spec

Superpowers writing-plans / executing-plans / TDD (execution). OpenSpec hand-authored (CLI not an executable here). Impeccable context: established Qingxin world, Operate mode, no init. Hallmark anti-slop lint later, not branding. CE/ECC/ponytail as same-run text. modern-web-guidance: canvas a11y via DOM twins; pause heavy RAF on hidden. ECC three.js skill not present in the cloned tree.
