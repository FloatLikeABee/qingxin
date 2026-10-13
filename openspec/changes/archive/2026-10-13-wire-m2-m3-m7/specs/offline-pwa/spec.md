## ADDED Requirements

### Requirement: Finance elder and wellness cache and outbox
The web client SHALL write finance, elder, and wellness snapshots into the existing IndexedDB `records` store and SHALL enqueue failed or offline creates on the existing `sync` outbox. Reconnect SHALL drain those ops through `QingxinApi` without a full reload.

#### Scenario: Cached finance snapshot readable offline
- **WHEN** a finance summary is loaded and later read from IndexedDB
- **THEN** the stored snapshot is returned

#### Scenario: Offline water create is queued
- **WHEN** adding water fails because the browser is offline
- **THEN** a `wellness_water_create` outbox op is stored
