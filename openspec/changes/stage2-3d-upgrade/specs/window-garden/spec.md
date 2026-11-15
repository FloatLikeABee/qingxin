# window-garden delta

## ADDED Requirements

### Requirement: Ten common vegetables
The garden SHALL define exactly ten everyday vegetables (tomato, cucumber, eggplant, chili, carrot, radish, cabbage, lettuce, spinach, scallion), all available from the start, with unique morphology signatures. Legacy ornamental and extra crop ids SHALL remap onto those ten vegetables.

### Requirement: Travelling insects
Bees, butterflies, ladybugs, aphids, caterpillars, and snails SHALL arrive, visit, optionally move, and leave. Pests damage while visiting. Pollinators speed growth. Predators remove pests. Beneficial catch SHALL scold. Living bugs SHALL be capped.

### Requirement: Prune and repot
Prune SHALL only apply at leaf/bud/bloom, restore health, and delay bloom if repeated too soon. Repot SHALL cost coins, increase pot size once, and raise harvest value. Both SHALL refuse with a notice when invalid.

### Requirement: Three.js play and schema 3
Play SHALL mount a Three.js window-sill scene when WebGL works. Pot selection SHALL be by pointing at the scene; a visible empty-pot button strip SHALL NOT be shown. Keyboard/screen-reader navigation SHALL remain. Save schema SHALL be 3 and MUST load schema 1 and 2 by remapping legacy plant ids without dropping plants, coins, harvests, or seeds.

## MODIFIED Requirements

### Requirement: Distinct plants
The garden SHALL define exactly ten common vegetables, all unlocked at the start.

### Requirement: Care loop
Players SHALL also prune and repot. Bugs SHALL travel.

### Requirement: Save and play view
Schema version 3. Schema 1 and 2 remain readable via vegetable remapping. Scene picking replaces the empty-pot strip. Control panels SHALL use translucent glass with a reduced-transparency fallback.
