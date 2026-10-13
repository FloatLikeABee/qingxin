# api-client Specification

## Purpose
Isolates network access behind a typed interface. `getApi()` selects `HttpQingxinApi` when `PUBLIC_API_URL` is set, otherwise `MockQingxinApi`.

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
The default implementation SHALL remain an in-memory mock when `PUBLIC_API_URL` is unset. It SHALL keep returning deterministic fixtures and simulating failure for sync tests. It SHALL NOT be the implementation used when `PUBLIC_API_URL` is set.

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

### Requirement: Local-life operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/search/sort services, fetch service detail, list/create reviews, flag corrections, and publish a service, and SHALL include the caller's reviews, submitted services, and corrections on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M4 operations
- **WHEN** a caller uses the API client
- **THEN** it can list services, search `宠物医院`, sort by distance or rating, open detail, create a review, flag `电话空号`, and publish a service

#### Scenario: Mock enforces category catalog
- **WHEN** the mock client publishes a service with category `酒吧`
- **THEN** it rejects with a typed `invalid_request` error

### Requirement: Create operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/create/update creations, list templates and inspiration, request generate/titles/polish/outline, list/create snippets, and increment snippet usage, and SHALL include creations and snippets on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M9 operations
- **WHEN** a caller uses the API client
- **THEN** it can create and list creations, list templates by platform, request generate, titles, polish, and outline, and create or use a snippet

#### Scenario: Mock enforces platform catalog
- **WHEN** the mock client generates with platform `微博`
- **THEN** it rejects with a typed `invalid_request` error

### Requirement: Toolbox operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list tools (with recent and favourites), toggle favourite, list tasks filtered by tool, and run a tool as an async stream of deltas plus a final task. Screens SHALL depend on that interface, not a concrete HTTP client. Export SHALL include `aiTasks` and `aiTemplates`.

#### Scenario: Interface covers M5 operations
- **WHEN** a caller uses the API client
- **THEN** it can list eight tools, favourite one, run summary, and list tasks by tool

#### Scenario: Mock enforces tool catalog
- **WHEN** the mock client runs tool id `translate`
- **THEN** it rejects with a typed `invalid_request` error

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

### Requirement: Finance operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list categories, list/create transactions, fetch summary and report, list/put budgets, list/create subscriptions (including upcoming), list/create/check-in challenges, and create a scheduled job. `HttpQingxinApi` SHALL send snake_case JSON that validates against `api/openapi.yaml` write schemas. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M2 operations
- **WHEN** a caller uses the API client
- **THEN** it can create a salary income transaction, create a subscription, put budgets as `{ items: [...] }`, and create a `web_push` job

#### Scenario: Optional nulls omitted
- **WHEN** a transaction note or challenge target amount is empty
- **THEN** the HTTP body omits that field instead of sending `null`

#### Scenario: Push job shape
- **WHEN** the client creates a job
- **THEN** the body has `kind` `web_push`, RFC3339 `run_at` with a numeric timezone offset, and `title`/`body` inside `payload`

### Requirement: Elder operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to fetch elder today, list/create reminders, acknowledge a reminder occurrence, list contacts, and patch the elder profile. Reminder writes SHALL use `days_of_week`, `voice_text`, and `timezone` and MUST NOT send `schedule_cron`.

#### Scenario: Interface covers M3 operations
- **WHEN** a caller uses the API client
- **THEN** it can `GET /v1/elder/today`, create a weekday medication reminder, and POST ack with `occurrence_at`

### Requirement: Wellness operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods for today, water, sleep, cycle consent, cycles, reports, plans/check-ins, goals, and reminders. Wellness reminder writes SHALL use `time_local` and `days_of_week`.

#### Scenario: Interface covers M7 operations
- **WHEN** a caller uses the API client
- **THEN** it can add water with `ml`/`logged_on`, add sleep with `sleep_at`/`wake_at`, put cycle consent, and create a 21-day plan

#### Scenario: Shape regression
- **WHEN** an adapter would send a camelCase field on a write body
- **THEN** the OpenAPI contract test fails
