# app-shell delta

## Requirement: Board navigation, no sidebar

The system SHALL use a compact top bar (首页, 模块中心, 我的) and the module center board as primary navigation. It SHALL NOT render a persistent left sidebar, a phone bottom tab bar, or a hamburger that restores that sidebar.

### Scenario: Desktop has no sidebar

- **WHEN** the viewport is 1280px and the user opens `/modules`
- **THEN** no `aside` is present, a top bar with 模块中心 is visible, and live module names are on the board

### Scenario: Phone has no leftover tabs

- **WHEN** the viewport is 390px and the user opens `/`
- **THEN** `nav.fixed` is absent and 我的 is in the top bar

### Scenario: 上班 stays reachable

- **WHEN** a guest opens `/` or `/modules`
- **THEN** heading 上班 is on the board or home hero and `/modules/shangban` still loads the sim
