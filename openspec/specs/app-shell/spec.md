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

The system SHALL present a hub listing these modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 宠物, 健康, 上班, 积木台, 秘密, 游戏. Opening 情绪日记+冥想 SHALL continue to load M1. Opening 健康 SHALL load the M7 wellness app (not the generic placeholder). Opening 上班 SHALL load the company sim (not the generic placeholder). Opening 积木台 SHALL load the construction sandbox (not the generic placeholder). `/modules/create` MAY still load the M9 studio as a legacy drafts route. Opening 游戏 SHALL load the games catalog (not a disabled 即将到来 tile). 组件 SHALL NOT appear as a hub module. 本地生活, AI效率工具箱, 学习打卡, and 求职副业 SHALL NOT appear as live hub modules; their old URLs SHALL show a retired notice or redirect.

#### Scenario: Hub lists the product modules

- **WHEN** a user opens the module hub
- **THEN** the module names above are listed

#### Scenario: Hustle is retired

- **WHEN** a user opens `/modules/hustle`
- **THEN** the page says 求职副业 was withdrawn and the 求职 tab is absent

#### Scenario: Local life is retired

- **WHEN** a user opens `/modules/local`
- **THEN** the page says 本地生活 was withdrawn and the 地图 / 列表 toggle is absent

#### Scenario: Health is a real module

- **WHEN** a user opens `/modules/health`
- **THEN** they land on the wellness 今日 screen (not the generic placeholder)

#### Scenario: Shangban is a real module

- **WHEN** a user opens `/modules/shangban`
- **THEN** the heading 上班 is announced and the play canvas or fallback is visible

#### Scenario: Legacy create studio remains

- **WHEN** a user opens `/modules/create`
- **THEN** the heading 内容创作 is visible and the 创作 tab includes a generate control

#### Scenario: Jimutai is a real module

- **WHEN** a user opens `/modules/jimutai`
- **THEN** the heading 积木台 is announced and the play canvas or fallback is visible

#### Scenario: AI toolbox is retired

- **WHEN** a user opens `/modules/ai`
- **THEN** the page says AI效率工具箱 was withdrawn and the 工具 tab is absent

#### Scenario: Games is a real module

- **WHEN** a user opens `/modules/games`
- **THEN** heading 轻心游戏 is visible

### Requirement: Home 积木台 overview

The home route SHALL remain zh-CN and SHALL include an 积木台 card instead of 求职概览.

#### Scenario: Home heading

- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN

#### Scenario: Home shows 积木台

- **WHEN** a user opens the home route
- **THEN** the page shows 积木台 and 去搭积木, and does not show 求职概览

### Requirement: Home shangban overview

The home route SHALL remain zh-CN and SHALL include an 上班 card with the five floor names.

#### Scenario: Home shows 上班 floors

- **WHEN** a user opens the home route
- **THEN** the page shows 上班 and 后勤与物流

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

### Requirement: Home and hub are bento

The home route and `/modules` hub SHALL arrange card-like sections in a bento host. Featured module tiles and hub tiles SHALL use varied spans on wide containers.

#### Scenario: Home heading still zh-CN

- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN and 积木台 / 上班 remain visible

#### Scenario: Hub lists modules in bento

- **WHEN** a user opens the module hub
- **THEN** module names including 秘密 are listed inside a `[data-bento]` host

### Requirement: Settings cards in bento

Settings SHALL place appearance, account, and 适老 cards in a bento without removing 已登录 / 退出登录 behavior.

#### Scenario: Logged-in settings stay in bento

- **WHEN** a user with a live session opens `/settings`
- **THEN** the page shows 已登录 and 退出登录 inside a `[data-bento]` host, and does not show a 登录 / 注册 row

### Requirement: Icon and text nav

Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 上班, 模块, 我的). The sidebar SHALL include a non-pricing 打开模块中心 call-to-action. 组件 SHALL NOT appear in primary nav.

#### Scenario: Four primary destinations

- **WHEN** the viewport is 390px
- **THEN** the bottom tab bar shows 首页, 上班, 模块, 我的 and does not show 组件 or 内容

#### Scenario: Kit from settings

- **WHEN** a user opens `/settings`
- **THEN** a 设计系统 row linking to `/kit` is present and 组件 is still absent from the tab bar

#### Scenario: Play hides phone tabs

- **WHEN** a user opens a `/play` route or `/modules/shangban`
- **THEN** the bottom tab bar is not shown so the game can use the full viewport
