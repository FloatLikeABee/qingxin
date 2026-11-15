# Spec Delta

## ADDED Requirements

### Requirement: Bouquet and window simulation
Core florist logic SHALL live in pure TypeScript without WebGL: stems with mood and color, assembling a bouquet, placing it in a three-slot shop window, customers with mood wants, freshness, and a day summary.

#### Scenario: Warm bouquet matches a 暖 guest
- **WHEN** a bouquet is mostly 暖 stems and a guest wants 暖
- **THEN** the offer scores at least 0.5 and the guest is counted happy

#### Scenario: Empty hand is refused
- **WHEN** the player tries to serve with no stems and no window bouquet
- **THEN** the action fails and the guest is not served

#### Scenario: Long wait
- **WHEN** a waiting guest exceeds patience
- **THEN** they leave unhappy

### Requirement: Playable flower shop
`/modules/games/corner-florist/play` SHALL mount a zh-CN flower-shop play view: window, stem buckets, workbench, pause, restart, 返回目录. Mouse and touch. No account required.

#### Scenario: Canvas-free chrome
- **WHEN** a user opens the florist play route with privacy consent
- **THEN** 橱窗 and 从桶里取花 controls are visible without requiring WebGL
