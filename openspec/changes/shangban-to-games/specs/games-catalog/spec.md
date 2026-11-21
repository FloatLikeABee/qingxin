# games-catalog Delta

## MODIFIED Requirements

### Requirement: Extensible games registry

The system SHALL expose a typed in-memory games registry. Seven games SHALL be playable: 便利店经理, 窗前庭园, 晴空出击, 潮汐呼吸, 云上散步, 记忆货架, 上班. 上班 SHALL use id `shangban`, category 经营, and play CTA 开始上班.

#### Scenario: Registry lists 上班

- **WHEN** the catalog is loaded
- **THEN** entry `shangban` has status `playable` and title 上班

#### Scenario: Placeholders remain gone

- **WHEN** the catalog is loaded
- **THEN** no registry entry has status `coming`

## ADDED Requirements

### Requirement: 上班 catalog play and legacy path

Selecting 上班 SHALL open `/modules/games/shangban`, whose Play CTA SHALL navigate to `/modules/games/shangban/play` and mount the existing workday sim. The play view SHALL link 返回目录 to `/modules/games`. Local progress SHALL remain on `qingxin.shangban` schema 2.

#### Scenario: Catalog play mounts 上班

- **WHEN** a user opens `/modules/games/shangban/play`
- **THEN** `[data-shangban="1"]` is present and 返回目录 is visible

#### Scenario: Save key is unchanged

- **WHEN** a schema-2 `qingxin.shangban` save with finance pay 44 is present
- **THEN** play restores role finance and pay 44
