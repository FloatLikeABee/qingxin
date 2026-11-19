# shangban Specification (workday delta)

## ADDED Requirements

### Requirement: Readable office framing

Play SHALL devote roughly three-quarters of a desktop or landscape viewport to the live office on the left, with a narrow glass work rail on the right. Play-mode camera SHALL focus the current floor so people and furniture are legible. Overview SHALL remain selectable. Phone portrait SHALL keep the scene prominent with collapsible controls. Scene station targets SHALL remain reachable.

#### Scenario: Desktop side layout

- **WHEN** the viewport is 1280×800
- **THEN** the canvas column is wider than the work rail and the rail sits to the right of the scene

#### Scenario: Focus vs overview

- **WHEN** the player is on floor 3 in play framing
- **THEN** the camera look-at uses floor 3 height; choosing 俯瞰 pulls back to the five-floor cutaway

### Requirement: Staged jobs

Each role SHALL keep its Stage 1 mechanic inside accept → prepare (workstation) → perform (simulation remaining time + checkpoints) → submit. Pay SHALL apply once on a valid submit. Walking away SHALL pause progress. Role switch with active work SHALL require an explicit drop with no pay.

#### Scenario: Submit once

- **WHEN** a 物流员 accepts, starts at 到货口, finishes progress, picks, and places on the matching bay
- **THEN** pay increases once and a second submit does not pay again

#### Scenario: Role switch drop

- **WHEN** the player has an active job and confirms 放下这单
- **THEN** the job is cancelled with no pay and the new role is selected

### Requirement: Close-once day and logs

The clock SHALL run 09:00–18:00 without wrapping. At 18:00 the sim SHALL pause, write one daily log, and wait for 下一天. Hidden tabs SHALL not roll extra days. Unfinished active jobs SHALL carry. Schema 1 saves SHALL migrate to schema 2 without wiping role, pay, or progress. Logs SHALL retain at most 14 days.

#### Scenario: End of day

- **WHEN** tick reaches the documented day length
- **THEN** exactly one log is appended and further ticks do not increase the log count until 下一天

#### Scenario: Schema 1 migrate

- **WHEN** localStorage holds a schema 1 上班 save with finance pay and an active audit
- **THEN** load yields schema-compatible play with the same role and pay and does not remove sibling keys
