# 窗前庭园 ten-vegetable + glass HUD (2026-11-15)

Ge: second pot never grows; only 3 kinds; want ~10 common vegetables from the start; drop empty-pot buttons; glassy panels for garden and store. Same PR 36. Shooter untouched.

## Root cause (proven)

Not a selected-only sim loop: `tickGarden` already walked every bed, and the renderer synced every mesh.

Second pot stall: the pictured second seed was lettuce (`water: high` = 3). Empty beds start at `water: 1`, `plantSeed` did not raise water, and `matched()` required `|water-need| <= 1`. Lettuce failed from tick 1 and stayed `seed`. Care buttons wrote only `selected` (default 0), so an unselected lettuce never got water. Water also drained every 36 ticks, so even a matching tomato could stall before ripe unless the selected pot was watered again.

Three types, not 64: the seed strip showed `owned OR unlockAt === 0`. Only tomato, lettuce, and mint were unlocked at harvests 0. The other 61 were harvest-gated, so a fresh garden never listed them.

Fix: ten start-unlocked vegetables; planting sets a live water/nutrient buffer; grow when `water >= 1 && nutrient >= 1`; name 渴了/饿了; slower drain; schema 3 remaps legacy ids.

## Plan

1. **RED** sim test: plant beds 0, 1, 11 with different starters, drive time with no extra water and no selection concept; assert all leave seed and can ripen. Catalog test: exactly 10 vegetables, all `unlockAt === 0`.
2. Fix growth so planting sets a live buffer and unmet needs pause with a visible 渴了/饿了, not a silent freeze. Independent of selection.
3. Replace catalog with 10 veggies; remap schema 1/2 plants and seed bags; schema 3.
4. Scene pick + strong outline; visually hide pot strip; sr-only bed list; camera/dock so every pot is tappable on 390 and 1280.
5. Glass HUD on garden and store; reduced-transparency fallback.
6. Playwright: fresh garden, canvas taps on first/second/last, real `tickGarden` elapsed time, ten seeds visible, store restock.

No extra games, no shooter edits, no merge.
