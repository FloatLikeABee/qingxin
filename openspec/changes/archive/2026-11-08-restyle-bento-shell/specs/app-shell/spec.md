# Spec Delta

## Purpose

Keeps zh-CN chrome while applying bento, short icon+text nav, and visible affordance on existing screens.

## ADDED Requirements

### Requirement: Home and hub are bento
The home route and `/modules` hub SHALL arrange card-like sections in a bento host. Featured module tiles and the ten hub tiles SHALL use varied spans on wide containers.

#### Scenario: Home heading still zh-CN
- **WHEN** a user opens the home route
- **THEN** primary headings and nav labels are zh-CN and 求职概览 / 内容创作 remain visible

#### Scenario: Hub lists ten modules in bento
- **WHEN** a user opens the module hub
- **THEN** all ten module names are listed inside a `[data-bento]` host

### Requirement: Settings cards in bento
Settings SHALL place appearance, account, and 适老 cards in a bento without removing 已登录 / 退出登录 behavior.

#### Scenario: Logged-in settings
- **WHEN** a user with a live session opens `/settings`
- **THEN** the page shows 已登录 and 退出登录, and does not show a 登录 / 注册 row

### Requirement: Icon and text nav
Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 模块, 组件, 我的). The sidebar SHALL include a non-pricing 打开模块中心 call-to-action.

#### Scenario: Four primary destinations
- **WHEN** the viewport is 390px
- **THEN** the bottom tab bar shows four labeled destinations
