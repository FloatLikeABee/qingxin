# app-shell Specification

## Purpose
Hosts the zh-CN product chrome: responsive navigation and a launcher for the ten Qingxin modules.

## Requirements

### Requirement: Chinese UI
User-facing chrome SHALL be written in zh-CN, including navigation labels, module names, empty states, and settings copy.

#### Scenario: Home heading
- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN

### Requirement: Responsive navigation
The system SHALL show a bottom tab bar on phone-width viewports and a sidebar on desktop-width viewports.

#### Scenario: Phone tabs
- **WHEN** the viewport is 390px wide
- **THEN** a bottom tab bar is visible and a persistent desktop sidebar is not

#### Scenario: Desktop sidebar
- **WHEN** the viewport is 1280px wide
- **THEN** a sidebar is visible for primary navigation

### Requirement: Module hub
The system SHALL present a hub listing these ten modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 本地生活, AI效率工具箱, 宠物, 健康, 学习打卡, 内容创作, 求职副业.

#### Scenario: Hub lists ten modules
- **WHEN** a user opens the module hub
- **THEN** all ten module names above are listed and each opens a module placeholder
