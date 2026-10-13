# Spec Delta

## ADDED Requirements

### Requirement: Pets operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/create pets, fetch today's care summary, list/create health records, weights, and daily logs, and SHALL map OpenAPI snake_case (`avatar_url`, `next_due_date`, `measured_on`, `weight_g`) to the existing camelCase pet types. `HttpQingxinApi` SHALL implement those methods via `/v1/pets*`. `MockQingxinApi` SHALL implement the same methods in memory. Screens SHALL depend on `QingxinApi`, not `fetch`.

#### Scenario: Interface covers M6 operations
- **WHEN** a caller uses the API client
- **THEN** it can create a pet, list pets, fetch today's summary, add a feed log, add a gram weight, and add a health record

#### Scenario: Pet write uses avatar_url and omits empties
- **WHEN** the HTTP client creates a pet with an avatar URL and empty breed
- **THEN** the JSON body includes `avatar_url` and MUST NOT include `avatarUrl`, `breed`, or `null` optional fields

### Requirement: Study operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to fetch today's study snapshot, create 7/14/21-day challenges, check in, list/create/review flashcards, list/create notes (`content_md`), list/create/patch skills (`parent_id`), list skill templates from the server, and copy a template by `template_id`. `HttpQingxinApi` SHALL implement those methods via `/v1/study*`. Review grade MUST be one of `again`, `hard`, `good`, `easy`.

#### Scenario: Interface covers M8 operations
- **WHEN** a caller uses the API client
- **THEN** it can create a 21-day challenge, check in, add a flashcard, post a review grade, save a note, list skill templates, and copy a template

#### Scenario: Challenge write rejects other lengths
- **WHEN** the client builds a challenge body with `targetDays` other than 7, 14, or 21
- **THEN** it MUST NOT send the request; the write helper rejects the value

#### Scenario: Contract test catches camelCase regression
- **WHEN** an adapter would send `avatarUrl` instead of `avatar_url`
- **THEN** the OpenAPI contract test fails
