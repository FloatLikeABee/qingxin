# bento-layout Specification

## Purpose

Provides a shared responsive bento grid so card-like sections use modular, asymmetric tiles with consistent gutters and no overflow.

## Requirements

### Requirement: Bento host and spans
The system SHALL provide a bento host that lays out children on CSS Grid with a single shared gutter token. Children SHALL opt into spans `unit`, `wide`, `hero`, or `full`. Interactive bento items SHALL keep source/DOM order (no dense auto-flow, no CSS `order` reordering).

#### Scenario: Hub uses varied spans
- **WHEN** a user opens `/modules` at a container wide enough for four columns
- **THEN** the first module tile spans two columns and two rows and at least one sibling tile spans two columns

#### Scenario: Narrow reflow
- **WHEN** the bento container is one column wide (phone 390px)
- **THEN** every tile occupies one column, the document does not scroll horizontally, and focus order matches DOM order

### Requirement: Container-driven columns
Column count SHALL follow the bento host’s inline size (container queries), not the viewport alone, so a desktop sidebar does not force four cramped columns.

#### Scenario: Sidebar still gets multiple columns
- **WHEN** the viewport is 1280px and the AppShell sidebar is visible
- **THEN** the home and module-hub bentos use more than one column

### Requirement: Consistent gutters
All bento tracks SHALL use the same gap (16px gutter token) rather than mixed child margins.

#### Scenario: Equal gap
- **WHEN** two adjacent bento items render
- **THEN** the grid gap used between them is the shared gutter token
