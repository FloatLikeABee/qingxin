# Spec Delta

## ADDED Requirements

### Requirement: Export includes wellness records
`GET /v1/privacy/export` SHALL include a `wellness` object with the caller's goals, water logs, sleep logs (notes decrypted), reports (metrics decrypted), plans, check-ins, reminders, and `cycle_consent`. Cycle rows (symptoms decrypted) MUST appear only when `cycle_consent` is true; otherwise `cycles` MUST be an empty array.

#### Scenario: Export lists the caller's wellness
- **WHEN** an authenticated user who has a water log and a sleep note calls `GET /v1/privacy/export`
- **THEN** the response is 200 and `wellness.water_logs` contains that log and `wellness.sleep_logs` contains the plaintext note

#### Scenario: Export omits cycles without consent
- **WHEN** an authenticated user with cycle_consent false calls export
- **THEN** `wellness.cycle_consent` is false and `wellness.cycles` is an empty array

### Requirement: Account deletion removes wellness rows
`DELETE /v1/privacy/account` MUST delete the user so that no `well_*` rows remain for that user_id (via foreign-key cascade or an explicit hook).

#### Scenario: Account deleted
- **WHEN** the user deletes their account after creating wellness rows
- **THEN** the response is 204 and no well_water_logs, well_sleep_logs, well_cycles, well_reports, well_plans or well_reminders rows remain for that user
