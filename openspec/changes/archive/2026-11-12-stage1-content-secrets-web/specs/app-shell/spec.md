# app-shell Delta

## MODIFIED Requirements

### Requirement: Icon and text nav
Primary AppShell destinations SHALL keep icon plus short zh-CN labels (首页, 内容, 模块, 我的). The sidebar SHALL include a non-pricing 打开模块中心 call-to-action. 组件 SHALL NOT appear in primary nav.

#### Scenario: Four primary destinations
- **WHEN** the viewport is 390px
- **THEN** the bottom tab bar shows 首页, 内容, 模块, 我的 and does not show 组件

### Requirement: Hub lists modules in bento
The module hub SHALL list existing modules plus 秘密, and MAY show a disabled 游戏 · 即将到来 tile that does not navigate.

#### Scenario: Secrets is a real module
- **WHEN** a user opens the module hub
- **THEN** 秘密 is listed and opens `/modules/secrets`
