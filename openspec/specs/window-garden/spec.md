# window-garden Specification

## Purpose
Runs 窗前庭园 as a browser-only endless Three.js window garden. Plant biology is simplified gameplay, not gardening advice.

## Requirements

### Requirement: Distinct plants
The garden SHALL define at least 60 plants with unique ids, Chinese names, unique morphology signatures, and water/light/nutrient needs. Families SHALL include herb, leafy, flower, vine, fruiting, rosette, tree, succulent, grass, and aquatic. c358d29 plant ids SHALL remain valid.

#### Scenario: Catalog size
- **WHEN** the plant catalog is loaded
- **THEN** it contains at least 60 unique ids and unique morphologies, including `tomato` and a post-c358d29 id such as `bokchoy`

### Requirement: Care loop
Players SHALL plant, water, feed, shade, prune, repot, harvest, and replant. Insects SHALL arrive, visit, move, and leave. Pests SHALL damage while visiting. Pollinators SHALL speed bloom. Predators SHALL eat pests. Catching a beneficial SHALL show a mistake notice. Prune on a young plant SHALL refuse. A second prune too soon SHALL delay bloom. Repot SHALL cost coins and raise harvest once. The garden SHALL NOT end after a harvest. If coins, seeds, and living plants are gone, 空园补给 SHALL restore a starter seed and water.

#### Scenario: Harvest funds the next plant
- **WHEN** a ripe plant is harvested
- **THEN** coins increase and the bed can be planted again

#### Scenario: Deadlock recovery
- **WHEN** the garden has no coins, no seeds, and no living plants
- **THEN** emergencyKit succeeds and planting is possible again

### Requirement: Save and play view
`/modules/games/window-garden/play` SHALL mount a zh-CN Three.js window garden when WebGL works, with DOM twins for pots, large contextual actions, a pictured filterable seed browser, pause, restart, 返回目录, and a simplified-gameplay disclaimer. localStorage save SHALL use schema version 2 and MUST load schema 1 without dropping plants or progress; corrupt JSON SHALL load a usable recovered garden. No account. Mouse, touch, and keyboard.

#### Scenario: Schema 1 migrate
- **WHEN** storage contains a schema-1 garden with a planted tomato
- **THEN** readGardenSave returns that tomato and recovered false

#### Scenario: Corrupt save
- **WHEN** storage contains `{nope`
- **THEN** readGardenSave returns a fresh garden with recovered true
