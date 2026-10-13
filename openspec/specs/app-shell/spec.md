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

### Requirement: Home job overview
The home route SHALL remain zh-CN and SHALL include a job-status overview and today's application/interview todos when the session has hustle data.

#### Scenario: Home heading
- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN

#### Scenario: Home shows funnel counts
- **WHEN** a demo session is restored and home loads
- **THEN** the page shows 求职概览 and the three statuses 投递, 面试, Offer

### Requirement: Home create overview
The home route SHALL remain zh-CN and SHALL include scenario cards for 小红书, 公众号, 抖音, and 周报 plus an inspiration feed when the session is present.

#### Scenario: Home shows four scenarios
- **WHEN** a demo session is restored and home loads
- **THEN** the page shows 内容创作 and the four platform names 小红书, 公众号, 抖音, 周报

### Requirement: Settings reflects session
When a session is present, Settings SHALL NOT offer 登录 / 注册 as the primary account action. It SHALL show the signed-in display name and a 退出登录 action that calls `logout()`. When no session is present, Settings MAY show 登录 / 注册.

#### Scenario: Logged-in settings hides login row
- **WHEN** a user with a live session opens `/settings`
- **THEN** the page shows 已登录 and 退出登录, and does not show a 登录 / 注册 row

#### Scenario: Logged-out settings shows login row
- **WHEN** a user with no session opens `/settings`
- **THEN** the page shows 登录 / 注册

### Requirement: Module apps share shell chrome
`/finance`, `/pets`, `/wellness`, and `/study` SHALL render inside the shared AppShell (desktop left sidebar, phone tabs) and SHALL include a 返回模块中心 link to `/modules`. The finance home SHALL have a visible page title 财务. The wellness home SHALL have a visible page title 健康.

#### Scenario: Finance desktop sidebar and back link
- **WHEN** the viewport is 1280px and the user opens `/finance`
- **THEN** the AppShell sidebar is visible, a 返回模块中心 link is present, and heading 财务 is visible

#### Scenario: Health page title and back link
- **WHEN** a user opens `/wellness`
- **THEN** heading 健康 is visible and a 返回模块中心 link is present

#### Scenario: Pets and study link back to the hub
- **WHEN** a user opens `/pets` or `/study`
- **THEN** a 返回模块中心 link is present
