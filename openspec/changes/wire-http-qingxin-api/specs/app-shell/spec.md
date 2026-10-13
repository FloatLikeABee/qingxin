# Spec Delta

## Purpose

Keep module apps and Settings consistent with the shared shell once a real session exists.

## ADDED Requirements

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
