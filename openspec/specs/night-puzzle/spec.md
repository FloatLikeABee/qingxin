# night-puzzle Specification

## Purpose
Compatibility alias. 夜窗拼图 was replaced by 晴空出击.

## Requirements

### Requirement: Redirect
`/modules/games/night-puzzle` and `/modules/games/night-puzzle/play` SHALL redirect to `sky-sortie`.

#### Scenario: Detail alias
- **WHEN** a user opens `/modules/games/night-puzzle`
- **THEN** they land on `/modules/games/sky-sortie`
