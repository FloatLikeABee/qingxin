# Spec Delta

## ADDED Requirements

### Requirement: Hustle records cache and outbox
The web client SHALL write applications, resumes, and side hustles into the existing IndexedDB `records` store and SHALL enqueue failed or offline creates/updates on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached applications readable offline
- **WHEN** an application is saved and the same key is read from IndexedDB
- **THEN** the stored application is returned

#### Scenario: Offline create is queued
- **WHEN** an application create is attempted while offline
- **THEN** an op of type `hustle_application_create` is listed in pending sync until drained
