# window-garden Specification

## Purpose
Runs 窗前庭园 as a browser-only endless garden. Plant biology is simplified gameplay, not gardening advice.

## Requirements

### Requirement: Distinct plants
The garden SHALL define at least 40 plants with unique ids, Chinese names, visual forms, and water/light/nutrient needs.

#### Scenario: Catalog size
- **WHEN** the plant catalog is loaded
- **THEN** it contains at least 40 unique ids and unique forms

### Requirement: Care loop
Players SHALL plant, water, feed, shade, harvest, and replant. Pests SHALL damage plants and can be removed. Pollinators and predators SHALL help and MUST be distinguishable. Catching a beneficial SHALL show a mistake notice. The garden SHALL NOT end after a harvest. If coins, seeds, and living plants are gone, 空园补给 SHALL restore a starter seed and water.

#### Scenario: Harvest funds the next plant
- **WHEN** a ripe plant is harvested
- **THEN** coins increase and the bed can be planted again

#### Scenario: Deadlock recovery
- **WHEN** the garden has no coins, no seeds, and no living plants
- **THEN** emergencyKit succeeds and planting is possible again

### Requirement: Save and play view
`/modules/games/window-garden/play` SHALL mount a zh-CN garden with beds, tools, a bug inspect action, pause, restart, 返回目录, and a simplified-gameplay disclaimer. localStorage save SHALL use schema version 1; corrupt JSON SHALL load a usable recovered garden. No account. Mouse and touch.

#### Scenario: Corrupt save
- **WHEN** storage contains `{nope`
- **THEN** readGardenSave returns a fresh garden with recovered true
