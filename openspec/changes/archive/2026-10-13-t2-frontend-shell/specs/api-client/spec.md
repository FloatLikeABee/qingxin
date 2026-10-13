# Spec Delta

## Purpose

Isolates network access behind a typed interface so the mock client can be replaced by T1's OpenAPI backend without rewriting screens.

## ADDED Requirements

### Requirement: Typed client interface
The system SHALL expose a TypeScript interface for session, auth, modules, export, and account-deletion operations. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers shell operations
- **WHEN** a caller uses the API client
- **THEN** it can login, register, read the session, list modules, export user data, and request account deletion through typed methods

### Requirement: Mock implementation
Until T1 lands, the default implementation SHALL be an in-memory mock that returns deterministic fixtures and can simulate failure for sync tests.

#### Scenario: Mock login success
- **WHEN** the mock client receives known-good credentials
- **THEN** it returns a session object with a user id and display name

#### Scenario: Mock login rejection
- **WHEN** the mock client receives empty credentials
- **THEN** it rejects with a typed error the UI can display
