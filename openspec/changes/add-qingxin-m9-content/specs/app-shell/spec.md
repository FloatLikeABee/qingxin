# Spec Delta

## MODIFIED Requirements

### Requirement: Module hub
The system SHALL present a hub listing these ten modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 本地生活, AI效率工具箱, 宠物, 健康, 学习打卡, 内容创作, 求职副业. Opening 求职副业 SHALL load the M10 workshop (not the generic placeholder). Opening 情绪日记+冥想 SHALL continue to load M1. Opening 内容创作 SHALL load the M9 studio (not the generic placeholder).

#### Scenario: Hub lists ten modules
- **WHEN** a user opens the module hub
- **THEN** all ten module names above are listed

#### Scenario: Hustle is a real module
- **WHEN** a user opens `/modules/hustle`
- **THEN** the heading 求职副业 is visible and the 求职 tab includes 简历

#### Scenario: Create is a real module
- **WHEN** a user opens `/modules/create`
- **THEN** the heading 内容创作 is visible and the 创作 tab includes a generate control

## ADDED Requirements

### Requirement: Home create overview
The home route SHALL remain zh-CN and SHALL include scenario cards for 小红书, 公众号, 抖音, and 周报 plus an inspiration feed when the session is present.

#### Scenario: Home shows four scenarios
- **WHEN** a demo session is restored and home loads
- **THEN** the page shows 内容创作 and the four platform names 小红书, 公众号, 抖音, 周报
