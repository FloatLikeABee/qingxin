# Spec Delta

## ADDED Requirements

### Requirement: Create records cache and outbox
The web client SHALL write creations and snippets into the existing IndexedDB `records` store and SHALL enqueue failed or offline creates on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached creations readable offline
- **WHEN** a creation is saved and the same key is read from IndexedDB
- **THEN** the stored creation is returned

#### Scenario: Offline create is queued
- **WHEN** a creation create is attempted while offline
- **THEN** an op of type `create_work_create` is listed in pending sync until drained
