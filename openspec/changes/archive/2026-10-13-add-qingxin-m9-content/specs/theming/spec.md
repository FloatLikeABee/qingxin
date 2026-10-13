# Spec Delta

## ADDED Requirements

### Requirement: Create editor ignores light tokens
The content-studio editor island SHALL keep the dark IDE palette even when the document root does not have class `dark`. Surrounding chrome SHALL continue to use the existing four theme modes. Platform preview frames MAY use a light mock surface.

#### Scenario: Light chrome, dark editor
- **WHEN** the user selects 浅色 and opens the 创作 tab
- **THEN** the module chrome uses light tokens and the editor island background is `#0F172A`
