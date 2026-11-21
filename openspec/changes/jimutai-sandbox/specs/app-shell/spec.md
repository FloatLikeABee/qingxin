# app-shell Specification (delta)

## Modified Requirements

### Requirement: Module hub

The hub SHALL list 上班, 秘密, 情绪日记+冥想, 个人财务小助手, 老人助手, 宠物, 健康, 积木台, 游戏. It SHALL NOT list 本地生活, AI效率工具箱, 学习打卡, 求职副业, 内容创作, or 组件 as live modules.

#### Scenario: Hub lists 积木台

- **WHEN** a user opens the module hub
- **THEN** heading 积木台 is visible and 求职副业 is not

### Requirement: Home job overview

REMOVED. Home SHALL show an 积木台 card instead of 求职概览.

#### Scenario: Home shows 积木台

- **WHEN** a user opens the home route
- **THEN** the page shows 积木台 and does not show 求职概览
