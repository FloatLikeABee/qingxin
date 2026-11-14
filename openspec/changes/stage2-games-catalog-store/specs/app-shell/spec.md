# Spec Delta

## MODIFIED Requirements

### Requirement: Module hub
The system SHALL present a hub listing existing life modules plus 游戏 as a real openable module. 组件 SHALL NOT appear as a hub module. Opening 游戏 SHALL load the games catalog, not a generic placeholder.

#### Scenario: Hub lists 游戏
- **WHEN** a user opens the module hub
- **THEN** 游戏 is listed as a heading and is not a disabled 即将到来 control

#### Scenario: Games is a real module
- **WHEN** a user opens `/modules/games`
- **THEN** heading 轻心游戏 is visible

### Requirement: Icon and text nav
Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 内容, 模块, 我的). 组件 SHALL NOT appear in primary nav. `/kit` MAY be linked from 我的 / settings only.

#### Scenario: Four primary destinations
- **WHEN** the viewport is 390px
- **THEN** the bottom tab bar shows 首页, 内容, 模块, 我的 and does not show 组件

#### Scenario: Kit from settings
- **WHEN** a user opens `/settings`
- **THEN** a 设计系统 row linking to `/kit` is present and 组件 is still absent from the tab bar
