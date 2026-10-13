# Spec Delta

## MODIFIED Requirements

### Requirement: JSON export
`GET /v1/privacy/export` SHALL require an access token and SHALL return a JSON document containing the user profile, consents, device sessions (no secrets), jobs, push subscriptions, the caller's mood logs with decrypted notes, meditation sessions, applications, resumes (content JSON), side hustles, creations, and snippets.

#### Scenario: Export requires login
- **WHEN** a client calls `GET /v1/privacy/export` without a token
- **THEN** the response is 401

#### Scenario: Export contains profile
- **WHEN** an authenticated user calls `GET /v1/privacy/export`
- **THEN** the response is 200 and includes `exported_at` and `user.id`

#### Scenario: Export contains mood data
- **WHEN** an authenticated user who created a mood log with a note calls export
- **THEN** `mood_logs` includes that note in plaintext and `meditation_sessions` is an array

#### Scenario: Export contains hustle data
- **WHEN** an authenticated user who created an application, a resume, and a side hustle calls export
- **THEN** `applications`, `resumes`, and `side_hustles` arrays include those ids

#### Scenario: Export contains create data
- **WHEN** an authenticated user who created a work and a snippet calls export
- **THEN** `creations` and `snippets` arrays include those ids

### Requirement: Account deletion
`DELETE /v1/privacy/account` SHALL remove the user and cascaded personal rows (tokens, consents, devices, jobs, push subscriptions, caregiver links, mood logs, meditation sessions, applications, resumes, side hustles, creations, snippets) and SHALL return 204. A later login or use of old tokens SHALL fail.

#### Scenario: Delete erases the account
- **WHEN** an authenticated user deletes their account
- **THEN** the response is 204 and a subsequent login with the same email returns 401

#### Scenario: Delete cascades hustle rows
- **WHEN** an authenticated user who created an application deletes their account
- **THEN** the response is 204 and that application id is gone from the database

#### Scenario: Delete cascades create rows
- **WHEN** an authenticated user who created a work and a snippet deletes their account
- **THEN** the response is 204 and those ids are gone from the database
