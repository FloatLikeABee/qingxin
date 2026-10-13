# Spec Delta

## ADDED Requirements

### Requirement: Toolbox records cache and outbox
The web client SHALL write toolbox tasks and the tool catalog into the existing IndexedDB `records` store and SHALL enqueue failed or offline favourite toggles on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached tasks readable offline
- **WHEN** a task list is saved and the same key is read from IndexedDB
- **THEN** the stored list is returned

#### Scenario: Offline favourite is queued
- **WHEN** a favourite toggle is attempted while offline
- **THEN** an op of type `tools_favourite` is listed in pending sync until drained
