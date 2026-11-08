# Spec Delta

## Purpose

Preserves the exact Qingxin palette while adding layout tokens required by bento.

## ADDED Requirements

### Requirement: Palette unchanged
Light primary `#3B82F6`, background `#FFFFFF`, text `#1F2937`, secondary `#6B7280` and dark primary `#60A5FA`, background `#111827`, text `#F9FAFB`, secondary `#9CA3AF` SHALL remain the resolved theme tokens.

#### Scenario: Light tokens
- **WHEN** the resolved appearance is light
- **THEN** CSS variables expose the light primary, background, text, and secondary values above

### Requirement: Gutter token
The system SHALL expose a 16px gutter token used by bento grids.

#### Scenario: Gutter is 16px
- **WHEN** layout CSS is loaded
- **THEN** `--qx-gutter` is `1rem`
