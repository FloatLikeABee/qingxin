# Spec Delta

## ADDED Requirements

### Requirement: Export includes pet records
`GET /v1/privacy/export` SHALL include a `pets` object with the caller's pets, health records (notes decrypted), weights, daily logs, and care reminders.

#### Scenario: Export lists the caller's pets
- **WHEN** an authenticated user who created a pet and a vet note calls `GET /v1/privacy/export`
- **THEN** the response is 200 and `pets.records` contains that note in plaintext

### Requirement: Account deletion removes pet rows
`DELETE /v1/privacy/account` MUST delete the user so that no `pet_*` rows remain for that user_id (via foreign-key cascade).

#### Scenario: Account deleted
- **WHEN** the user deletes their account after creating pet rows
- **THEN** the response is 204 and no `pet_pets`, `pet_health_records`, `pet_weights`, `pet_daily_logs`, or `pet_reminders` rows remain for that user
