# Spec Delta

## ADDED Requirements

### Requirement: Hustle operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/create/update resumes and applications, list/create side hustles, fetch the funnel and question catalog, request resume optimize, mock-interview, and side-hustle suggestions, and include those collections on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M10 operations
- **WHEN** a caller uses the API client
- **THEN** it can create and list applications, move an application status, create resume versions, list questions by role, and request the three stubbed AI helpers

#### Scenario: Mock enforces status catalog
- **WHEN** the mock client patches an application to status `归档`
- **THEN** it rejects with a typed `invalid_request` error
