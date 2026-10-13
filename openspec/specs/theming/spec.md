# theming Specification

## Purpose
Resolves the user's theme preference into a light or dark appearance and applies the Qingxin palette without a first-paint flash.

## Requirements

### Requirement: Theme modes
The system SHALL support four theme modes: light (浅色), dark (深色), system (跟随系统), and night-only (仅夜间开启). System SHALL follow `prefers-color-scheme`. Night-only SHALL use dark appearance from 19:00 inclusive through 07:00 exclusive in the user's local time, and light appearance otherwise.

#### Scenario: Explicit dark
- **WHEN** the user selects 深色
- **THEN** the resolved appearance is dark regardless of system preference or clock time

#### Scenario: System follows OS
- **WHEN** the user selects 跟随系统 and the OS prefers dark
- **THEN** the resolved appearance is dark

#### Scenario: Night-only during night window
- **WHEN** the user selects 仅夜间开启 and the local time is 19:00
- **THEN** the resolved appearance is dark

#### Scenario: Night-only during day window
- **WHEN** the user selects 仅夜间开启 and the local time is 12:00
- **THEN** the resolved appearance is light

### Requirement: Exact palette
The system SHALL apply these tokens: light primary `#3B82F6`, background `#FFFFFF`, text `#1F2937`, secondary `#6B7280`; dark primary `#60A5FA`, background `#111827`, text `#F9FAFB`, secondary `#9CA3AF`. Tokens SHALL cover page background, cards, dividers, button states, icon fills, and chart colors.

#### Scenario: Light tokens
- **WHEN** the resolved appearance is light
- **THEN** CSS variables expose the light primary, background, text, and secondary values above

#### Scenario: Dark tokens
- **WHEN** the resolved appearance is dark
- **THEN** CSS variables expose the dark primary, background, text, and secondary values above

### Requirement: Class strategy without flash
The system SHALL switch appearance by toggling a `dark` class on the document root using Tailwind's class strategy, and SHALL apply the stored preference before first paint so a stored dark mode does not flash light.

#### Scenario: Stored dark before paint
- **WHEN** a returning user has stored 深色
- **THEN** the document root has class `dark` before the first painted frame
