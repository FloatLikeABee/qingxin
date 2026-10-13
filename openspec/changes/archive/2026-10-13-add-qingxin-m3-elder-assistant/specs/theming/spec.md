# Spec Delta

## ADDED Requirements

### Requirement: Global elder mode
The system SHALL offer a global 适老 preference, stored with the other appearance settings, that toggles an `elder` class on the document root. While it is on, root type SHALL be at least 18px and contrast tokens SHALL strengthen text, muted text, and lines. The four existing theme modes MUST keep working. The kit MUST NOT be restyled component-by-component.

#### Scenario: Toggle is global
- **WHEN** the user enables 适老 on the settings page and then opens the home route
- **THEN** the document root has class `elder` and computed root font-size is at least 18px

#### Scenario: Theme modes still apply
- **WHEN** 适老 is on and the user selects 深色
- **THEN** the document root has both `elder` and `dark`

#### Scenario: Off by default
- **WHEN** a user has never set 适老
- **THEN** the document root does not have class `elder`
