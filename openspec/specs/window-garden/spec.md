# window-garden Specification

## Purpose
Runs 窗前庭园 as a browser-only endless Three.js window garden of common vegetables. Plant biology is simplified gameplay, not gardening advice.

## Requirements

### Requirement: Ten common vegetables
The garden SHALL define exactly ten everyday vegetables: tomato, cucumber, eggplant, chili, carrot, radish, cabbage, lettuce, spinach, and scallion. Each SHALL have a unique id, Chinese name, unique morphology signature, and water/light/nutrient needs. All ten SHALL be available from the start (`unlockAt` 0) with one starter seed each. The seed browser SHALL list all ten without a harvest unlock gate. Ornamental flowers, cacti, trees, and other non-vegetable species SHALL NOT appear in the playable catalog.

#### Scenario: Catalog size
- **WHEN** the plant catalog is loaded
- **THEN** it contains exactly those ten vegetable ids, all `unlockAt` 0, and ten unique morphologies

### Requirement: Care loop
Players SHALL plant, water, feed, shade, prune, repot, harvest, and replant. Every planted pot SHALL grow independently when watered enough (`water >= 1` and `nutrient >= 1`); selection SHALL NOT be required for growth. If a pot cannot grow, the UI SHALL name the blocker as 渴了 or 饿了. Insects SHALL arrive, visit, move, and leave. Pests SHALL damage while visiting. Pollinators SHALL speed bloom. Predators SHALL eat pests. Catching a beneficial SHALL show a mistake notice. Prune on a young plant SHALL refuse. A second prune too soon SHALL delay bloom. Repot SHALL cost coins and raise harvest once. The garden SHALL NOT end after a harvest. If coins, seeds, and living plants are gone, 空园补给 SHALL restore a starter seed and water.

#### Scenario: Harvest funds the next plant
- **WHEN** a ripe plant is harvested
- **THEN** coins increase and the bed can be planted again

#### Scenario: Independent pots
- **WHEN** the first, second, and last pots are planted with different vegetables and left unselected
- **THEN** elapsed ticks advance all three through visible stages to ripe without extra watering

#### Scenario: Deadlock recovery
- **WHEN** the garden has no coins, no seeds, and no living plants
- **THEN** emergencyKit succeeds and planting is possible again

### Requirement: Save and play view
`/modules/games/window-garden/play` SHALL mount a zh-CN Three.js window garden when WebGL works. Normal pot selection SHALL be by pointing at pots in the scene; a visible empty-pot button strip SHALL NOT be shown. Keyboard and screen-reader navigation SHALL remain available without a second 12-button row. The canvas and glass control dock SHALL be arranged so every pot stays tappable on a 390-wide phone and on desktop. Large contextual actions, a pictured seed browser of the ten vegetables, pause, restart, 返回目录, and a simplified-gameplay disclaimer SHALL remain. localStorage save SHALL use schema version 3 and MUST load schema 1 and schema 2 by remapping legacy plant ids onto the ten vegetables without dropping coins, water, fertilizer, harvests, or planted beds. Corrupt JSON SHALL load a usable recovered garden. No account. Mouse, touch, and keyboard.

#### Scenario: Schema 1 migrate
- **WHEN** storage contains a schema-1 garden with a planted tomato and mint seeds
- **THEN** readGardenSave returns that tomato, remaps mint seeds to scallion, and recovered false

#### Scenario: Schema 2 migrate
- **WHEN** storage contains a schema-2 garden with sunflower, fern, and cactus beds
- **THEN** those beds become chili, lettuce, and radish and coins are unchanged

#### Scenario: Corrupt save
- **WHEN** storage contains `{nope`
- **THEN** readGardenSave returns a fresh garden with recovered true
