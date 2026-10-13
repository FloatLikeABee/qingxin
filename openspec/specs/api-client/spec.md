# api-client Specification

## Purpose
Isolates network access behind a typed interface so the mock client can be replaced by T1's OpenAPI backend without rewriting screens.

## Requirements

### Requirement: Typed client interface
The system SHALL expose a TypeScript interface for session, auth, modules, export, account-deletion, mood logs, mood trends, mood insights, monthly summaries, meditation sessions, the meditation catalog, resumes, applications, side hustles, the hustle funnel, the interview catalog, and the three stubbed hustle AI helpers. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers shell operations
- **WHEN** a caller uses the API client
- **THEN** it can login, register, read the session, list modules, export user data, and request account deletion through typed methods

#### Scenario: Interface covers M1 operations
- **WHEN** a caller uses the API client
- **THEN** it can create/list mood logs, fetch trends, request an insight and a monthly summary, list the meditation catalog, and create/list meditation sessions

### Requirement: Mock implementation
The default implementation SHALL be an in-memory mock that returns deterministic fixtures, enforces the same note-length and catalog rules as the API, and can simulate failure for sync tests.

#### Scenario: Mock login success
- **WHEN** the mock client receives known-good credentials
- **THEN** it returns a session object with a user id and display name

#### Scenario: Mock login rejection
- **WHEN** the mock client receives empty credentials
- **THEN** it rejects with a typed error the UI can display

#### Scenario: Mock rejects a long note
- **WHEN** the mock client creates a mood log with a 100-character note
- **THEN** it rejects with a typed `invalid_request` error

### Requirement: Hustle operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/create/update resumes and applications, list/create side hustles, fetch the funnel and question catalog, request resume optimize, mock-interview, and side-hustle suggestions, and include those collections on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M10 operations
- **WHEN** a caller uses the API client
- **THEN** it can create and list applications, move an application status, create resume versions, list questions by role, and request the three stubbed AI helpers

#### Scenario: Mock enforces status catalog
- **WHEN** the mock client patches an application to status `归档`
- **THEN** it rejects with a typed `invalid_request` error
