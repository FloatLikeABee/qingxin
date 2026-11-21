# 重卡 delta

## Requirement: Connected recycled road graph

The sim SHALL generate wide paved pieces with ≥1 legal continuation, feasible turn radius, and recycle live pools (road ≤12, trees ≤80, buildings ≤40, dummy cars ≤6) so a 50 km generation does not grow unbounded.

### Scenario: Graph stays connected
- **WHEN** pieces are generated from a seed
- **THEN** every non-frontier piece has at least one child continuation and every curve radius is at or above the biome minimum

## Requirement: Arcade heavy-truck handling

Throttle raises speed, brake lowers it, steer changes yaw, reverse makes speed negative. Off-road is a scrape; stuck/crash recovers at the last on-road checkpoint and keeps the odometer.

### Scenario: Reverse and recover
- **WHEN** the guest selects reverse and throttles
- **THEN** speed becomes negative
- **WHEN** the truck is stuck off-road
- **THEN** recover restores an on-road pose and odometer does not reset
