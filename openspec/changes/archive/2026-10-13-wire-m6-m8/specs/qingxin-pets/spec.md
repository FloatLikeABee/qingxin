# Spec Delta

## ADDED Requirements

### Requirement: Pets pages use the real API through reactive stores
The pets web app SHALL load and mutate pet data only through `getApi()` (`HttpQingxinApi` when `PUBLIC_API_URL` is set). Stores SHALL use `$state` so creating a pet immediately leaves the empty state and remains listed after reload.

#### Scenario: Adding a pet saves
- **WHEN** the user adds a pet named 豆豆
- **THEN** `POST /v1/pets` returns 201, the page leaves the empty state immediately, and 豆豆 is still listed after reload

#### Scenario: API-seeded pets appear
- **WHEN** pets exist for the user on the API
- **THEN** `/pets` renders them instead of the empty state

#### Scenario: Feed check-in updates today
- **WHEN** the user logs 喂食 for that pet
- **THEN** today's done count for feed increases after the API create succeeds
