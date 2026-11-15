# sky-sortie Specification

## Purpose
Runs 晴空出击 as a browser-only endless 2D jet shooter.

## Requirements

### Requirement: Combat simulation
Core logic SHALL live in pure TypeScript without WebGL: automatic fire, steering, exactly three lives, invulnerability after a hit, distinct enemy scores, avoidable wrecks, recurring telegraphed bosses, continuation after a boss, elapsed-time capped stepping, and bounded entity lists. Best score MAY persist in localStorage under `qingxin.games.sky-sortie`.

#### Scenario: Three lives then game over
- **WHEN** the player takes three unprotected hits
- **THEN** lives are 0 and the run is over

#### Scenario: Invulnerability
- **WHEN** the player was just hit
- **THEN** a second overlap does not remove another life until invulnerability expires

#### Scenario: Distinct scores
- **WHEN** a scout, fighter, and bomber are destroyed
- **THEN** each adds a different score amount

#### Scenario: Boss then continue
- **WHEN** a boss is destroyed
- **THEN** the score increases by the boss value and later waves still spawn enemies

### Requirement: Play view
`/modules/games/sky-sortie/play` SHALL mount a zh-CN Canvas 2D flight view with HUD, pause, restart, 返回目录. Keyboard and touch on the playfield. Pause when the document is hidden. No account.

#### Scenario: Guest play
- **WHEN** a user opens the play route with privacy consent and no session
- **THEN** the canvas and 暂停 control are visible
