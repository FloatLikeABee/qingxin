# Spec Delta

## MODIFIED Requirements

### Requirement: Module hub
The system SHALL present a hub listing these ten modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 本地生活, AI效率工具箱, 宠物, 健康, 学习打卡, 内容创作, 求职副业. Opening 求职副业 SHALL load the M10 workshop (not the generic placeholder). Opening 情绪日记+冥想 SHALL continue to load M1. Opening 本地生活 SHALL load the M4 map (not the generic placeholder). Opening 健康 SHALL load the M7 wellness app (not the generic placeholder). Opening 内容创作 SHALL load the M9 studio (not the generic placeholder). Opening AI效率工具箱 SHALL load the M5 toolbox (not the generic placeholder).

#### Scenario: Hub lists ten modules
- **WHEN** a user opens the module hub
- **THEN** all ten module names above are listed

#### Scenario: Hustle is a real module
- **WHEN** a user opens `/modules/hustle`
- **THEN** the heading 求职副业 is visible and the 求职 tab includes 简历

#### Scenario: Local life is a real module
- **WHEN** a user opens `/modules/local`
- **THEN** the heading 本地生活 is visible and the 地图 / 列表 toggle is present

#### Scenario: Health is a real module
- **WHEN** a user opens `/modules/health`
- **THEN** they land on the wellness 今日 screen (not the generic placeholder)

#### Scenario: Create is a real module
- **WHEN** a user opens `/modules/create`
- **THEN** the heading 内容创作 is visible and the 创作 tab includes a generate control

#### Scenario: AI toolbox is a real module
- **WHEN** a user opens `/modules/ai`
- **THEN** the heading AI效率工具箱 is visible and the 工具 tab includes 摘要
