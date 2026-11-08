# design-system Specification

## Purpose
Provides a shared zh-CN component kit so every screen keeps 44px targets, 16px key text, and consistent feedback states.

## Requirements

### Requirement: Kit primitives
The system SHALL provide Button, Card, Input, Textarea, Tag, Tabs, Switch, Toast, bottom Drawer, Modal, Skeleton, EmptyState, ListItem, Icon, Bento, and BentoItem components, documented on a `/kit` demo route.

#### Scenario: Kit route lists primitives
- **WHEN** a user opens `/kit`
- **THEN** each primitive listed above is visible and labeled in zh-CN

### Requirement: Touch and type scale
Interactive controls SHALL have a minimum height of 44px and key information text SHALL be at least 16px.

#### Scenario: Primary button height
- **WHEN** a primary Button renders
- **THEN** its tap target is at least 44 CSS pixels tall

### Requirement: Reduced motion
Micro-animations SHALL run by default and SHALL disable or reduce motion when `prefers-reduced-motion: reduce` is set.

#### Scenario: Reduced motion honored
- **WHEN** the user prefers reduced motion
- **THEN** breathing glow and enter transitions do not animate continuously

### Requirement: Password visibility toggle
Password `Input`s SHALL include an in-field toggle (right-aligned, ≥44px) that switches the native input type between `password` and `text` and exposes zh-CN `aria-label`s 显示密码 / 隐藏密码.

#### Scenario: Toggle reveals password
- **WHEN** a user on `/login` activates 显示密码
- **THEN** the password field’s type is `text`

### Requirement: Clickable links
Textual navigation links (login ↔ register, 返回模块中心) SHALL use a shared link class with primary color and underline so they do not look like static text.

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
