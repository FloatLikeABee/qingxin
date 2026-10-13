# Spec Delta

## ADDED Requirements

### Requirement: Toolbox operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list tools (with recent and favourites), toggle favourite, list tasks filtered by tool, and run a tool as an async stream of deltas plus a final task. Screens SHALL depend on that interface, not a concrete HTTP client. Export SHALL include `aiTasks` and `aiTemplates`.

#### Scenario: Interface covers M5 operations
- **WHEN** a caller uses the API client
- **THEN** it can list eight tools, favourite one, run summary, and list tasks by tool

#### Scenario: Mock enforces tool catalog
- **WHEN** the mock client runs tool id `translate`
- **THEN** it rejects with a typed `invalid_request` error
