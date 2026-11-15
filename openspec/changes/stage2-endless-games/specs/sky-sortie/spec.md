## ADDED Requirements

### Requirement: Endless jet combat
`sky-sortie` SHALL run a pure TypeScript 2D combat sim without WebGL: automatic fire, player steering, exactly three lives, invulnerability after a hit, distinct enemy scores, avoidable wreck obstacles, recurring bosses with telegraph then attack, waves that continue after a boss, elapsed-time capped stepping, and bounded entity arrays. Losing all lives ends the run. Best score MAY persist in localStorage.

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
`/modules/games/sky-sortie/play` SHALL show a zh-CN Canvas 2D flight view, HUD, pause, restart, 返回目录. Keyboard and touch. Pause when the tab is hidden. No account.

#### Scenario: Guest play
- **WHEN** a user opens the play route with privacy consent and no session
- **THEN** the canvas and 暂停 control are visible
