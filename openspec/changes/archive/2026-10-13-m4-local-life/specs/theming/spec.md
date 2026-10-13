# Spec Delta

## ADDED Requirements

### Requirement: Dark local map and bright service cards
In dark appearance, the local-life map SHALL use a dark tile/background treatment and highlighted (brighter, larger) selected markers. Service cards on the local-life screens SHALL use a slightly brighter border than the default kit Card ring.

#### Scenario: Dark map background
- **WHEN** the user selects 深色 and opens `/modules/local` on the stub provider
- **THEN** the map surface uses a dark background token and a selected marker is visually emphasized

#### Scenario: Dark card border
- **WHEN** the user selects 深色 and a service card is shown
- **THEN** the card uses the local-life bright-border class
