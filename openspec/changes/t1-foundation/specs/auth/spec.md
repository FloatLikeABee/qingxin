# Spec Delta

## Purpose
Lets a person create and resume a Qingxin account with email/password or a stubbed phone OTP, using short-lived access JWTs and rotating refresh tokens.

## ADDED Requirements

### Requirement: Email and password registration
The system SHALL create a user from email, password (minimum 8 characters), display name, and a privacy-policy version. The password SHALL be stored as an Argon2 hash. A successful register SHALL return 201 with an access token, a refresh token, and the public user record.

#### Scenario: Register succeeds
- **WHEN** a client submits a unique email, a password of at least 8 characters, a display name, and a consent policy version
- **THEN** the response is 201 and includes `access_token`, `refresh_token`, and `user.email`

#### Scenario: Duplicate email
- **WHEN** a client registers an email that already exists
- **THEN** the response is 409 with error code `conflict`

### Requirement: Email and password login
The system SHALL verify email and password and issue the same token pair as register. Invalid credentials SHALL return 401 `invalid_credentials` without revealing whether the email exists.

#### Scenario: Login succeeds
- **WHEN** a registered user posts the correct email and password to `/v1/auth/login`
- **THEN** the response is 200 and a later `GET /v1/me` with the access token returns that user

#### Scenario: Login rejects a bad password
- **WHEN** a client posts a known email with the wrong password
- **THEN** the response is 401 with error code `invalid_credentials`

### Requirement: Refresh rotation
The system SHALL accept a refresh token, revoke it, and issue a new access and refresh pair that share the previous token family. Reuse of a revoked refresh token SHALL revoke every unrevoked token in that family and SHALL return 401.

#### Scenario: Refresh rotates
- **WHEN** a client posts a valid unused refresh token
- **THEN** the response is 200 with a new refresh token and the old refresh token is rejected on a later call

#### Scenario: Refresh reuse is detected
- **WHEN** a client posts a refresh token that was already rotated
- **THEN** the response is 401 and other refresh tokens in that family no longer work

### Requirement: Phone SMS stub
The system SHALL accept `POST /v1/auth/sms/request` with an E.164 phone and persist a hashed one-time code. When the SMS stub flag is enabled the response MAY include `dev_code`. `POST /v1/auth/sms/verify` SHALL issue tokens on a correct unused code and SHALL create the user on first success. A wrong or expired code SHALL return 401.

#### Scenario: Stub request returns a dev code
- **WHEN** the SMS stub is enabled and a client requests a code for a valid phone
- **THEN** the response is 200 and includes `dev_code`

#### Scenario: Stub verify creates a session
- **WHEN** the client verifies that `dev_code` for the same phone
- **THEN** the response is 200 with tokens and `GET /v1/me` returns a user whose phone matches

### Requirement: Access token authentication
Protected routes SHALL accept `Authorization: Bearer <access_jwt>` and SHALL reject missing, expired, or malformed tokens with 401 `unauthenticated`.

#### Scenario: Me requires a token
- **WHEN** a client calls `GET /v1/me` without an Authorization header
- **THEN** the response is 401 with error code `unauthenticated`
