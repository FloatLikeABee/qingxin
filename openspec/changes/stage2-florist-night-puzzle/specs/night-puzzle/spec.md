# Spec Delta

## ADDED Requirements

### Requirement: Night shard simulation
Core puzzle logic SHALL live in pure TypeScript without WebGL: a 4×3 window of unique night shards, shuffled tray, correct placement occupies a slot, wrong placement is rejected, completion when every slot is filled. Wind MAY reshuffle unplaced tray pieces only.

#### Scenario: Correct place
- **WHEN** a shard is placed on its home slot
- **THEN** that slot becomes occupied

#### Scenario: Wrong place
- **WHEN** a shard is placed on a different slot
- **THEN** the slot stays empty and a miss is counted

#### Scenario: Complete night
- **WHEN** every slot holds its home shard
- **THEN** the puzzle is complete

### Requirement: Living window play
`/modules/games/night-puzzle/play` SHALL show a window of night, a tray of shards, tap-to-place controls, pause, restart, 返回目录. Placed regions SHALL feel alive (light/motion). No account required.

#### Scenario: Play chrome
- **WHEN** a user opens the night play route with privacy consent
- **THEN** the window grid and a tray of 夜色拼块 are visible
