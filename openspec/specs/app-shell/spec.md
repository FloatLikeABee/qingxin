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
The system SHALL present a hub listing these ten modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 本地生活, AI效率工具箱, 宠物, 健康, 学习打卡, 内容创作, 求职副业. Opening 求职副业 SHALL load the M10 workshop (not the generic placeholder). Opening 情绪日记+冥想 SHALL continue to load M1.

#### Scenario: Hub lists ten modules
- **WHEN** a user opens the module hub
- **THEN** all ten module names above are listed

#### Scenario: Hustle is a real module
- **WHEN** a user opens `/modules/hustle`
- **THEN** the heading 求职副业 is visible and the 求职 tab includes 简历

### Requirement: Home job overview
The home route SHALL remain zh-CN and SHALL include a job-status overview and today's application/interview todos when the session has hustle data.

#### Scenario: Home heading
- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN

#### Scenario: Home shows funnel counts
- **WHEN** a demo session is restored and home loads
- **THEN** the page shows 求职概览 and the three statuses 投递, 面试, Offer
