# window-garden delta

## ADDED Requirements

### Requirement: Sixty distinct morphologies
The garden SHALL define at least 60 plants with unique ids, Chinese names, and unique morphology signatures (family, leaf, bloom, fruit, stems, height, leaf count). Families SHALL include herb, leafy, flower, vine, fruiting, rosette, tree, succulent, grass, and aquatic. Existing c358d29 ids SHALL remain valid.

### Requirement: Travelling insects
Bees, butterflies, ladybugs, aphids, caterpillars, and snails SHALL arrive, visit, optionally move, and leave. Pests damage while visiting. Pollinators speed growth. Predators remove pests. Beneficial catch SHALL scold. Living bugs SHALL be capped.

### Requirement: Prune and repot
Prune SHALL only apply at leaf/bud/bloom, restore health, and delay bloom if repeated too soon. Repot SHALL cost coins, increase pot size once, and raise harvest value. Both SHALL refuse with a notice when invalid.

### Requirement: Three.js play and schema 2
Play SHALL mount a Three.js window-sill scene when WebGL works, with DOM twins for selection and a written fallback when it does not. Save schema SHALL be 2 and MUST load schema 1 without dropping plants, coins, harvests, or seeds.

## MODIFIED Requirements

### Requirement: Distinct plants
The garden SHALL define at least 60 plants (was 40).

### Requirement: Care loop
Players SHALL also prune and repot. Bugs SHALL travel.

### Requirement: Save and play view
Schema version 2. Schema 1 remains readable.
