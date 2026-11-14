## ADDED Requirements

### Requirement: Playable replacements
The catalog SHALL list three playable games: 便利店经理 (`convenient-store`), 窗前庭园 (`window-garden`), 晴空出击 (`sky-sortie`). 街角花店 and 夜窗拼图 SHALL NOT remain as playable titles. 潮汐呼吸, 云上散步, 记忆货架 SHALL remain `coming`.

#### Scenario: Registry
- **WHEN** the catalog is loaded
- **THEN** playable ids are `convenient-store`, `window-garden`, and `sky-sortie`

#### Scenario: Old florist URL
- **WHEN** a user opens `/modules/games/corner-florist`
- **THEN** they are redirected to `/modules/games/window-garden`

#### Scenario: Old night URL
- **WHEN** a user opens `/modules/games/night-puzzle`
- **THEN** they are redirected to `/modules/games/sky-sortie`

### Requirement: 飞行 category
The catalog SHALL include category 飞行 and 晴空出击 SHALL use it. Category tiles SHALL include 飞行.

#### Scenario: Filter 飞行
- **WHEN** the category is `飞行`
- **THEN** 晴空出击 is included and 便利店经理 is not
