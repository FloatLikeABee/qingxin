# Spec Delta

## Purpose

Extends the kit so controls match the UX instruction slides: labeled fields, password visibility, visible links, skeletons, and 3–5 tabs.

## ADDED Requirements

### Requirement: Password visibility toggle
Password `Input`s SHALL include an in-field toggle (right-aligned, ≥44px) that switches the native input type between `password` and `text` and exposes zh-CN `aria-label`s 显示密码 / 隐藏密码.

#### Scenario: Toggle reveals password
- **WHEN** a user on `/login` activates 显示密码
- **THEN** the password field’s type is `text`

### Requirement: Clickable links
Textual navigation links (login ↔ register, 返回模块中心) SHALL use a shared link class with primary color, underline, and a trailing chevron so they do not look like static text.

#### Scenario: Register link looks clickable
- **WHEN** a user opens `/login`
- **THEN** the 创建账号 link is underlined and uses the primary color

### Requirement: Skeleton instead of classic spinner
The kit Skeleton SHALL offer a page variant that mirrors layout (blocks/lines), and module placeholder loading SHALL use Skeleton rather than a centered indefinite spinner.

#### Scenario: Kit shows skeleton
- **WHEN** a user opens `/kit`
- **THEN** a Skeleton primitive is visible

### Requirement: Tabs stay within 3–5
The Tabs primitive SHALL size columns to `tabs.length` (3–5) instead of a hardcoded 3-column grid.

#### Scenario: Three tabs still fill the row
- **WHEN** Tabs renders 日记 / 趋势 / 冥想
- **THEN** three tab buttons appear in one row

### Requirement: Button padding and 44px
Primary buttons SHALL keep min-height 44px and use generous inline padding (at least 24px) so labels are not flush to the sides.

#### Scenario: Primary button target
- **WHEN** a primary Button renders
- **THEN** its tap target is at least 44 CSS pixels tall
