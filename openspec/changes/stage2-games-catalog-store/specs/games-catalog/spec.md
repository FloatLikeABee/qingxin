# Spec Delta

## Purpose
Holds an extensible frontend games registry and a Qingxin-skinned shop-catalog face so players can browse, filter, open a presentation page, and launch a playable game.

## ADDED Requirements

### Requirement: Extensible games registry
The system SHALL expose a typed in-memory games registry that can list multiple games. Each entry SHALL include an id, zh-CN title, short description, category, tags, cover motif, and status `playable` or `coming`. Stage 2 SHALL include exactly one playable game (便利店经理) and one or more 即将到来 placeholders that still appear in the grid.

#### Scenario: Registry lists a playable store game
- **WHEN** the catalog is loaded
- **THEN** an entry with id `convenient-store`, title 便利店经理, and status `playable` is present

#### Scenario: Placeholders remain visible
- **WHEN** the catalog is loaded
- **THEN** at least two entries with status `coming` are listed with zh-CN titles

### Requirement: Search and category filter
The system SHALL filter the registry by a case-insensitive search over title, English title, summary, category, and tags, and by an exact category (including 全部 meaning no category constraint). Filtering SHALL be a pure function with no DOM or WebGL.

#### Scenario: Search by Chinese title
- **WHEN** the query is `经理`
- **THEN** 便利店经理 is included and unrelated titles may be excluded

#### Scenario: Filter by 经营
- **WHEN** the category is `经营`
- **THEN** every returned game has category 经营

#### Scenario: Empty query returns all
- **WHEN** search is blank and category is 全部
- **THEN** the full registry is returned

### Requirement: Games module is listed and openable
The module hub SHALL list 游戏 as a real module (not a disabled 即将到来 tile). Opening it SHALL load the games catalog route.

#### Scenario: Hub opens catalog
- **WHEN** a user opens `/modules` and follows 游戏
- **THEN** they land on `/modules/games` and see heading 轻心游戏

### Requirement: Catalog face
`/modules/games` SHALL present, in zh-CN: a hero with a play CTA for the featured game, colorful category tiles, a search field, a featured game, and a responsive card grid (2 columns at 390px, at least 3 at 1280px). Cards SHALL show a cover, title, short description, and tags/category, with hover lift when motion is allowed. Dark appearance SHALL use existing Qingxin dark tokens. The face SHALL use Qingxin primary blue and coral/teal/gold accents, not an orange shop primary.

#### Scenario: Phone grid
- **WHEN** the viewport is 390px on `/modules/games`
- **THEN** the game card grid is visible with heading 轻心游戏 and a search field

#### Scenario: Category tiles
- **WHEN** the user opens the catalog
- **THEN** tiles for 经营, 休闲, 益智, and 节奏 are visible

### Requirement: Card to detail to Play
Selecting a game card SHALL open a presentation route with cover, about copy, and a Play CTA. For `playable` games the CTA SHALL navigate to a dedicated play route. For `coming` games the CTA SHALL be disabled or labeled 即将到来 and SHALL NOT enter a 3D session. The play route SHALL offer 返回目录.

#### Scenario: Playable detail
- **WHEN** a user opens `/modules/games/convenient-store`
- **THEN** heading 便利店经理 is visible and a 开始经营 control links to the play route

#### Scenario: Coming soon cannot play
- **WHEN** a user opens a `coming` game's detail
- **THEN** a 即将到来 control is present and no 3D canvas is mounted
