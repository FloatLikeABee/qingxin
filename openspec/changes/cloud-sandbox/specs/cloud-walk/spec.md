# 云上散步 ghost sandbox delta

## Requirement: One connected fly/dive volume

The playable field SHALL be one cylinder R=42, Y ∈ [−14, +18] with no loading gates, unlocks, quests, combat, or timers. `over` stays false.

### Scenario: Climb without an island
- **WHEN** the guest holds 飞升 / Space from home
- **THEN** Y exceeds 6 while remaining in the garden belt

### Scenario: Dive through the well
- **WHEN** the guest holds 潜入 / Shift at the mirror well
- **THEN** biome becomes water then underworld at negative Y

## Requirement: Ghost avatar and 6DOF steer

The walker SHALL be a translucent teardrop ghost with inner glow and wisps, not a peach human. Movement is camera-relative XZ plus rise/dive. 跳一下 is gone.

### Scenario: Touch rise and dive
- **WHEN** a 390px guest holds 飞升 then 潜入
- **THEN** Y increases then decreases and both targets are at least 44px tall

## Requirement: Schema 2 reads schema 1 without wipes

`qingxin.games.cloud-walk` schema 2 SHALL keep fragments, garden, skyMode, creatures, and settings; map visited isles to biomes; restore in-cylinder position or home with 「云界变大了，从家里再走。」 Other `qingxin.*` keys stay untouched.

### Scenario: Sun and rain garden migrate
- **WHEN** a schema 1 save with two collected fragments and two garden plants is loaded
- **THEN** those plants and fragments remain, theme and tide keys are unchanged, and the rewrite is schema 2
