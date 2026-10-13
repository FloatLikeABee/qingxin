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
`GET /v1/privacy/export` SHALL require an access token and SHALL return a JSON document containing the user profile, consents, device sessions (no secrets), jobs, and push subscriptions.

#### Scenario: Export requires login
- **WHEN** a client calls `GET /v1/privacy/export` without a token
- **THEN** the response is 401

#### Scenario: Export contains profile
- **WHEN** an authenticated user calls `GET /v1/privacy/export`
- **THEN** the response is 200 and includes `exported_at` and `user.id`

### Requirement: Account deletion
`DELETE /v1/privacy/account` SHALL remove the user and cascaded personal rows (tokens, consents, devices, jobs, push subscriptions, caregiver links) and SHALL return 204. A later login or use of old tokens SHALL fail.

#### Scenario: Delete erases the account
- **WHEN** an authenticated user deletes their account
- **THEN** the response is 204 and a subsequent login with the same email returns 401

### Requirement: Export includes finance records
`GET /v1/privacy/export` SHALL include a `finance` object with the caller's categories, transactions (notes decrypted), budgets, subscriptions, challenges and check-ins.

#### Scenario: Export lists the caller's ledger
- **WHEN** an authenticated user who has a transaction calls `GET /v1/privacy/export`
- **THEN** the response is 200 and `finance.transactions` contains that transaction with a plaintext note

### Requirement: Account deletion removes finance rows
`DELETE /v1/privacy/account` MUST delete the user so that no `fin_*` rows remain for that user_id (via foreign-key cascade or an explicit hook).

#### Scenario: Account deleted
- **WHEN** the user deletes their account after creating finance rows
- **THEN** the response is 204 and no fin_transactions, fin_budgets, fin_subscriptions or fin_savings_challenges rows remain for that user
