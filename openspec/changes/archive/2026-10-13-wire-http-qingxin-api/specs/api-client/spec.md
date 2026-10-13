# Spec Delta

## Purpose

Replace the mock-only factory with a real HTTP client that implements `QingxinApi` against the T1 OpenAPI contract, while keeping the mock for tests and unset `PUBLIC_API_URL`.

## ADDED Requirements

### Requirement: HTTP implementation
The system SHALL provide an `HttpQingxinApi` class that implements the TypeScript `QingxinApi` interface by calling the Axum service under `/v1`. Screens SHALL keep depending on `QingxinApi`, not `fetch`.

#### Scenario: Login issues a session from the API
- **WHEN** `PUBLIC_API_URL` is set and the client logs in with valid credentials
- **THEN** it `POST`s `/v1/auth/login`, stores access and refresh tokens, and `getSession()` returns the user from `/v1/me`

#### Scenario: Register sends privacy consent
- **WHEN** the HTTP client registers a user
- **THEN** the request body includes `display_name` and `consent.policy_version`

#### Scenario: Unauthenticated getSession is null
- **WHEN** the HTTP client has no stored tokens or `/v1/me` and refresh both fail
- **THEN** `getSession()` resolves to `null` rather than throwing

### Requirement: Factory selection
`getApi()` SHALL return `HttpQingxinApi` when `PUBLIC_API_URL` is a non-empty string and SHALL return `MockQingxinApi` when it is unset or blank. `resetApi()` SHALL still inject a client for tests.

#### Scenario: Unset URL uses the mock
- **WHEN** `PUBLIC_API_URL` is unset
- **THEN** `getApi()` returns a `MockQingxinApi`

#### Scenario: Set URL uses HTTP
- **WHEN** `PUBLIC_API_URL` is `http://127.0.0.1:8080`
- **THEN** `getApi()` returns an `HttpQingxinApi` whose base URL is that origin without a trailing slash

### Requirement: Wire mapping and errors
The HTTP client SHALL map OpenAPI snake_case JSON to the existing camelCase `QingxinApi` types and SHALL turn `{ error: { code, message } }` plus network failures into `ApiError`. Access-token 401 SHALL refresh once via `/v1/auth/refresh` and retry.

#### Scenario: Mood log maps timestamps
- **WHEN** the API returns a mood log with `created_at`
- **THEN** the client exposes `createdAt` on the `MoodLog`

#### Scenario: API error becomes ApiError
- **WHEN** the API responds 401 with `error.code` `invalid_credentials`
- **THEN** the client rejects with `ApiError` whose `code` is `invalid_credentials`

#### Scenario: Expired access token is refreshed
- **WHEN** a Bearer request returns 401 and a refresh token is stored
- **THEN** the client posts `/v1/auth/refresh` and retries the original request once

## MODIFIED Requirements

### Requirement: Mock implementation
The default implementation SHALL remain an in-memory mock when `PUBLIC_API_URL` is unset. It SHALL keep returning deterministic fixtures and simulating failure for sync tests. It SHALL NOT be the implementation used when `PUBLIC_API_URL` is set.

#### Scenario: Mock login success
- **WHEN** the mock client receives known-good credentials
- **THEN** it returns a session object with a user id and display name

#### Scenario: Mock login rejection
- **WHEN** the mock client receives empty credentials
- **THEN** it rejects with a typed error the UI can display
