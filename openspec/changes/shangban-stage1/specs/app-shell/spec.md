# app-shell Delta

## MODIFIED Requirements

### Requirement: Module hub
The system SHALL present a hub listing these modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 本地生活, AI效率工具箱, 宠物, 健康, 学习打卡, 上班, 求职副业, 秘密, 游戏. Opening 上班 SHALL load the Stage 1 company sim (not the generic placeholder). Opening 内容创作 via `/modules/create` MAY still load the M9 studio as a legacy route. 组件 SHALL NOT appear as a hub module.

#### Scenario: Hub lists 上班
- **WHEN** a user opens the module hub
- **THEN** 上班 is listed and 内容创作 is not a hub tile

#### Scenario: Legacy studio route
- **WHEN** a user opens `/modules/create`
- **THEN** the heading 内容创作 is still visible and drafts are not deleted

### Requirement: Icon and text nav
Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 上班, 模块, 我的). 组件 SHALL NOT appear in primary nav.

#### Scenario: Four primary destinations
- **WHEN** the viewport is 390px
- **THEN** the bottom tab bar shows 首页, 上班, 模块, 我的 and does not show 内容 or 组件

### Requirement: Home create overview
The home route SHALL include an 上班 card (five floor names and a play CTA) instead of the 内容创作 platform grid.

#### Scenario: Home shows 上班
- **WHEN** a user opens the home route
- **THEN** the page shows 上班 and 求职概览, and does not require the 小红书 home grid

### Requirement: Play hides phone tabs
`/modules/shangban` SHALL hide the phone tab bar like `/play` routes so the building can use the viewport.

#### Scenario: Shangban is full-viewport
- **WHEN** a user opens `/modules/shangban`
- **THEN** the bottom tab bar is not shown
