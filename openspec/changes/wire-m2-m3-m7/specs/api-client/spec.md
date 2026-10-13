## ADDED Requirements

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
