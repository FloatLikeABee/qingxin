# app-shell Delta

## MODIFIED Requirements

### Requirement: Module hub

The system SHALL present a hub listing these modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 宠物, 健康, 积木台, 秘密, 游戏. It SHALL NOT list 上班 as a hub tile. Opening 游戏 SHALL load the games catalog, which SHALL include playable 上班. Opening `/modules/shangban` SHALL redirect to `/modules/games/shangban/play` and show the company sim. `/modules/create` MAY still load the M9 studio as a legacy drafts route.

#### Scenario: Hub lists the product modules

- **WHEN** a user opens the module hub
- **THEN** 游戏, 秘密, and 积木台 are listed and 上班 is not a board tile

#### Scenario: Shangban deep link still plays

- **WHEN** a user opens `/modules/shangban`
- **THEN** they land on `/modules/games/shangban/play` with heading 上班 and the play canvas or fallback

### Requirement: Icon and text nav

Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 模块中心, 我的). 上班 SHALL be reached from the games catalog (and home shortcut), not a hub tile or a fourth chrome tab. 组件 SHALL NOT appear in primary nav.

#### Scenario: Play hides chrome

- **WHEN** a user opens `/modules/games/shangban/play` or `/modules/shangban`
- **THEN** the top bar and space-dust canvas are not shown so the game can use the full viewport
