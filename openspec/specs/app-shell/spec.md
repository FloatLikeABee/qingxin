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

The system SHALL navigate from a compact top bar (首页, 模块中心, 我的) and the module center board. It SHALL NOT show a persistent left sidebar, a phone bottom tab bar, or a hamburger that restores that sidebar.

#### Scenario: Phone has no leftover tabs

- **WHEN** the viewport is 390px wide
- **THEN** a top bar is visible, `nav.fixed` is absent, and a persistent desktop sidebar is not

#### Scenario: Desktop has no sidebar

- **WHEN** the viewport is 1280px wide
- **THEN** no `aside` is present and the top bar includes 模块中心

### Requirement: Viewport-fixed top bar

The compact glass top bar SHALL be `position: fixed` to the viewport on non-play routes. It SHALL NOT travel with page scroll. In-flow content SHALL start below the bar, and the document scrollport SHALL use `scroll-padding-top` at least as large as the bar (including safe-area inset) so focused controls and fragment targets are not hidden. Play routes SHALL continue to omit the top bar.

#### Scenario: Header stays pinned while the page scrolls

- **WHEN** a user scrolls a long home, module center, or settings surface
- **THEN** the top bar's viewport bounding rect stays put while `scrollTop` increases

### Requirement: Hidden scrollbar chrome

Qingxin pages and existing overflow panels SHALL hide classic scrollbar chrome while remaining scrollable with wheel, trackpad, touch, and keyboard. The document SHALL NOT set `overflow: hidden` on `html` or `body` merely to hide that chrome. Horizontal overflow regions SHALL still scroll.

#### Scenario: Scrollbar is gone but content still scrolls

- **WHEN** a page is taller than the viewport
- **THEN** no classic scrollbar gutter is reserved, computed `scrollbar-width` is `none`, and wheel or keyboard still changes `scrollTop`

### Requirement: Module hub

The system SHALL present a hub listing these modules: 情绪日记+冥想, 个人财务小助手, 老人助手, 宠物, 健康, 积木台, 秘密, 游戏. Opening 情绪日记+冥想 SHALL continue to load M1. Opening 健康 SHALL load the M7 wellness app (not the generic placeholder). Opening 积木台 SHALL load the construction sandbox (not the generic placeholder). 上班 SHALL NOT appear as a hub tile; it SHALL appear as a playable game in the games catalog. Opening `/modules/shangban` SHALL redirect to `/modules/games/shangban/play` and load the company sim. `/modules/create` MAY still load the M9 studio as a legacy drafts route. Opening 游戏 SHALL load the games catalog (not a disabled 即将到来 tile). 组件 SHALL NOT appear as a hub module. 本地生活, AI效率工具箱, 学习打卡, and 求职副业 SHALL NOT appear as live hub modules; their old URLs SHALL show a retired notice or redirect.

#### Scenario: Hub lists the product modules

- **WHEN** a user opens the module hub
- **THEN** 游戏, 秘密, and 积木台 are listed and 上班 is not a board tile

#### Scenario: Hustle is retired

- **WHEN** a user opens `/modules/hustle`
- **THEN** the page says 求职副业 was withdrawn and the 求职 tab is absent

#### Scenario: Local life is retired

- **WHEN** a user opens `/modules/local`
- **THEN** the page says 本地生活 was withdrawn and the 地图 / 列表 toggle is absent

#### Scenario: Health is a real module

- **WHEN** a user opens `/modules/health`
- **THEN** they land on the wellness 今日 screen (not the generic placeholder)

#### Scenario: Shangban deep link still plays

- **WHEN** a user opens `/modules/shangban`
- **THEN** they land on `/modules/games/shangban/play` and the heading 上班 is announced with the play canvas or fallback visible

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

`/finance`, `/pets`, `/wellness`, and `/study` SHALL render inside the shared AppShell (compact top bar, no sidebar) and SHALL include a 返回模块中心 link to `/modules`. The finance home SHALL have a visible page title 财务. The wellness home SHALL have a visible page title 健康.

#### Scenario: Finance desktop top bar and back link

- **WHEN** the viewport is 1280px and the user opens `/finance`
- **THEN** the AppShell top bar is visible, a 返回模块中心 link is present, and heading 财务 is visible

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

Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 模块中心, 我的). 上班 SHALL be reached from the games catalog and the home shortcut, not a hub tile or a fourth chrome tab. 组件 SHALL NOT appear in primary nav.

#### Scenario: Three primary destinations

- **WHEN** the viewport is 390px
- **THEN** the top bar shows 首页, 模块中心, 我的 and does not show 组件 or 内容

#### Scenario: Kit from settings

- **WHEN** a user opens `/settings`
- **THEN** a 设计系统 row linking to `/kit` is present and 组件 is still absent from the top bar

#### Scenario: Play hides chrome

- **WHEN** a user opens a `/play` route, `/modules/games/shangban/play`, or `/modules/shangban`
- **THEN** the top bar and space-dust canvas are not shown so the game can use the full viewport
