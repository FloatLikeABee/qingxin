# privacy Specification

## Purpose
Records privacy-policy acceptance and gives the account owner a JSON export and a hard delete of their personal data.

## Requirements

### Requirement: Consent is stored
The system SHALL persist each accepted `policy_version` with a timestamp and user id. Registration SHALL require a consent object. `GET /v1/privacy/consent` SHALL return the latest row.

#### Scenario: Register stores consent
- **WHEN** a user registers with `consent.policy_version` `2026-10-13`
- **THEN** `GET /v1/privacy/consent` with their access token returns that policy version

### Requirement: JSON export
`GET /v1/privacy/export` SHALL require an access token and SHALL return a JSON document containing the user profile, consents, device sessions (no secrets), jobs, push subscriptions, the caller's mood logs with decrypted notes, and meditation sessions.

#### Scenario: Export requires login
- **WHEN** a client calls `GET /v1/privacy/export` without a token
- **THEN** the response is 401

#### Scenario: Export contains profile
- **WHEN** an authenticated user calls `GET /v1/privacy/export`
- **THEN** the response is 200 and includes `exported_at` and `user.id`

#### Scenario: Export contains mood data
- **WHEN** an authenticated user who created a mood log with a note calls export
- **THEN** `mood_logs` includes that note in plaintext and `meditation_sessions` is an array

### Requirement: Account deletion
`DELETE /v1/privacy/account` SHALL remove the user and cascaded personal rows (tokens, consents, devices, jobs, push subscriptions, caregiver links, mood logs, meditation sessions) and SHALL return 204. A later login or use of old tokens SHALL fail.

#### Scenario: Delete erases the account
- **WHEN** an authenticated user deletes their account
- **THEN** the response is 204 and a subsequent login with the same email returns 401
