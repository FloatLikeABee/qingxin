# Spec Delta

## MODIFIED Requirements

### Requirement: JSON export
`GET /v1/privacy/export` SHALL require an access token and SHALL return a JSON document containing the user profile, consents, device sessions (no secrets), jobs, push subscriptions, the caller's mood logs with decrypted notes, meditation sessions, applications, resumes (content JSON), and side hustles.

#### Scenario: Export contains hustle data
- **WHEN** an authenticated user who created an application, a resume, and a side hustle calls export
- **THEN** `applications`, `resumes`, and `side_hustles` arrays include those ids

### Requirement: Account deletion
`DELETE /v1/privacy/account` SHALL remove the user and cascaded personal rows (tokens, consents, devices, jobs, push subscriptions, caregiver links, mood logs, meditation sessions, applications, resumes, side hustles) and SHALL return 204.

#### Scenario: Delete cascades hustle rows
- **WHEN** an authenticated user who created an application deletes their account
- **THEN** the response is 204 and that application id is gone from the database
