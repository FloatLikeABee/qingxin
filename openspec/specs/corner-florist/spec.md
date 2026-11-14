# corner-florist Specification

## Purpose
Compatibility alias. 街角花店 was replaced by 窗前庭园.

## Requirements

### Requirement: Redirect
`/modules/games/corner-florist` and `/modules/games/corner-florist/play` SHALL redirect to `window-garden`.

#### Scenario: Detail alias
- **WHEN** a user opens `/modules/games/corner-florist`
- **THEN** they land on `/modules/games/window-garden`
