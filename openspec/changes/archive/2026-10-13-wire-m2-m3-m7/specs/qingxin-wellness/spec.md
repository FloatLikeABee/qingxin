## ADDED Requirements

### Requirement: Wellness pages use the real API
Wellness screens SHALL read today, water, sleep, cycles, reports, and plans through `QingxinApi` (HTTP when `PUBLIC_API_URL` is set). Cycle writes SHALL require prior consent via `PUT /v1/wellness/consent`. Empty optional notes SHALL be omitted from write bodies.

#### Scenario: Water cup updates today
- **WHEN** the user taps +1 杯 on the health home
- **THEN** the client POSTs `/v1/wellness/water` with `ml` and `logged_on` and the ring reflects the server total

#### Scenario: Sleep omits empty note
- **WHEN** the user saves sleep without a note
- **THEN** the request body has `sleep_at`, `wake_at`, and `quality` and does not include `note: null`
