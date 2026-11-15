# Spec Delta

## MODIFIED Requirements

### Requirement: Extensible games registry
The system SHALL expose a typed in-memory games registry that can list multiple games. Each entry SHALL include an id, zh-CN title, short description, category, tags, cover motif, and status `playable` or `coming`. Stage 2 follow-up SHALL include three playable games (便利店经理, 街角花店, 夜窗拼图) and keep the remaining 即将到来 placeholders visible.

#### Scenario: Registry lists three playable games
- **WHEN** the catalog is loaded
- **THEN** entries `convenient-store`, `corner-florist`, and `night-puzzle` have status `playable`

#### Scenario: Placeholders remain visible
- **WHEN** the catalog is loaded
- **THEN** 潮汐呼吸, 云上散步, and 记忆货架 remain `coming`

### Requirement: Card to detail to Play
Selecting a game card SHALL open a presentation route with cover, about copy, and a Play CTA whose label fits the game. For `playable` games the CTA SHALL navigate to a dedicated play route. For `coming` games the CTA SHALL be disabled or labeled 即将到来.

#### Scenario: Florist detail
- **WHEN** a user opens `/modules/games/corner-florist`
- **THEN** heading 街角花店 is visible and 开始配花 links to the play route

#### Scenario: Night puzzle detail
- **WHEN** a user opens `/modules/games/night-puzzle`
- **THEN** heading 夜窗拼图 is visible and 开始拼夜 links to the play route
