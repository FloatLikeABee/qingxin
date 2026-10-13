# Spec Delta

## ADDED Requirements

### Requirement: Mood records cache and outbox
The web client SHALL write mood logs and meditation sessions into the existing IndexedDB `records` store and SHALL enqueue failed or offline creates on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached logs readable offline
- **WHEN** a check-in is saved and the same key is read from IndexedDB
- **THEN** the stored log is returned

#### Scenario: Offline create is queued
- **WHEN** a check-in is attempted while the outbox handler is used
- **THEN** an op of type `mood_log_create` is listed in pending sync until drained
