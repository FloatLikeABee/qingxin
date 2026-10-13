# Spec Delta

## ADDED Requirements

### Requirement: Local-life records cache and outbox
The web client SHALL write the services catalog, reviews, and corrections into the existing IndexedDB `records` store and SHALL enqueue failed or offline review/publish/correction creates on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached services readable offline
- **WHEN** a services list is saved and the same key is read from IndexedDB
- **THEN** the stored list is returned

#### Scenario: Offline review is queued
- **WHEN** a review create is attempted while offline
- **THEN** an op of type `local_review_create` is listed in pending sync until drained
