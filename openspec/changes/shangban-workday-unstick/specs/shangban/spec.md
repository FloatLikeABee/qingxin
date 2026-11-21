# shangban unstick delta

## Requirement: Next-day work is not frozen by yesterday’s break

A leftover `breakUntil` SHALL NOT block walking or job progress after 下一天 or after loading a day-2 save.

### Scenario: Late rest then next morning
- **WHEN** the player rests near 18:00 and starts the next day
- **THEN** they can start a job and `ticksSpent` increases

## Requirement: Start work is never silently inert

开始干活 / 去工位开始 SHALL path to the required station when away and SHALL start perform on arrival. The play root SHALL expose `data-block` for prepare/away/break/paused/submit.

### Scenario: Start from the elevator
- **WHEN** a courier accepts a job at the elevator and chooses 去工位开始
- **THEN** they walk to 到货口, stage becomes `perform`, and progress rises without a cheat tick

## Requirement: Stored checkpoints submit once

A valid quote, ship plan, audit decision, allocation, decision, part, or matching bay chosen before the bar fills SHALL pay when progress and checkpoints are ready, without requiring the same click again.

### Scenario: Sales quote then wait
- **WHEN** sales quotes a price under the hidden max during perform
- **THEN** filling the bar awards pay once

### Scenario: Reload mid-job with a stored plan
- **WHEN** an engineer has chosen 写测试, the save is reloaded, and the bar later fills
- **THEN** the stored plan is restored and the job pays without a second click

## Requirement: 1x wall clock matches sim ticks

A visible 1x day SHALL credit real animation-frame gaps up to the existing hitch cap (`MAX_STEP_MS`), not a tighter 50ms clamp that makes 18:00 arrive late while the job is still running.

### Scenario: Slow frames still tick at 1x
- **WHEN** a frame arrives 83ms after the previous one at 1x
- **THEN** the sim is credited 83ms, not 50ms

## Requirement: Elevator arrival does not keep walking the old floor’s path

Calling the elevator SHALL clear `player.path` so a leftover destination cannot pull the player away from the new floor’s stand.

### Scenario: Path then ride
- **WHEN** the player has a walk path and calls the elevator
- **THEN** the path is empty while riding and after arrival
