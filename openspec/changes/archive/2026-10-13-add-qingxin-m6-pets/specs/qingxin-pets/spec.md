# Spec Delta

## Purpose

Gives an authenticated Qingxin user owner-only pet profiles, health records with due reminders, gram weight history, daily care check-ins, and a nearby-services placeholder, without veterinary advice.

## ADDED Requirements

### Requirement: Pet profiles are owner-isolated
The system SHALL let an authenticated user create, list, update and delete their own pets. Another user's pet id MUST return 404. Missing or invalid tokens MUST return 401 with error code `unauthenticated`.

#### Scenario: Other user's pet
- **WHEN** user B GETs `/v1/pets/{A's id}`
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a client calls `GET /v1/pets` without a token
- **THEN** the API responds 401 with error code `unauthenticated`

### Requirement: Pets stay owner-only
Pet resources MUST be keyed by the caller's user id. The API MUST NOT grant caregiver or family access to another user's pets in v1.

#### Scenario: Caregiver cannot read a linked user's pet
- **WHEN** a caregiver who is linked to user A requests user A's pet id
- **THEN** the API responds 404

### Requirement: Avatar is a URL field
A pet MAY store an optional `avatar_url` string. The system MUST NOT accept file uploads or persist image bytes for avatars.

#### Scenario: Profile stores a URL
- **WHEN** the user creates a pet with `avatar_url` `https://cdn.example/doudou.png`
- **THEN** later GET returns that URL and no binary avatar column exists

### Requirement: Health records schedule due reminders
Creating a health record with `next_due_date` SHALL enqueue a `scheduled_jobs` row of kind `pet.due` whose `run_at` is 09:00 in the owner's timezone on the calendar day before that date. Editing or deleting the record MUST replace or cancel the pending job.

#### Scenario: Vaccine due reminder fires
- **WHEN** a vaccine record with `next_due_date` is created and the scheduler ticks at `run_at`
- **THEN** a PushMessage is recorded for the owner and the job payload type is `pet.due`

#### Scenario: Edit replaces the pending job
- **WHEN** the user patches `next_due_date` on a record that already has a pending `pet.due` job
- **THEN** the old job is cancelled or replaced and one pending job remains for the new date

### Requirement: Daily care check-in
The system SHALL accept a daily log of type `feed`, `walk`, `groom`, or `litter` for a pet the caller owns. `GET /v1/pets/today` SHALL return per-type done counts for each owned pet.

#### Scenario: Feed check-in updates today
- **WHEN** the user logs 喂食 (`feed`) for 豆豆
- **THEN** today summary shows feed done = 1 for that pet

### Requirement: Care reminders use time plus weekdays
Care reminder rules MUST require `HH:MM` and a non-empty list of ISO weekdays 1–7, validated with the shared elder schedule helpers. Empty `days_of_week` MUST return 400.

#### Scenario: Empty weekdays rejected
- **WHEN** `days_of_week` is empty
- **THEN** the API responds 400 with error code `invalid_request`

#### Scenario: Valid rule enqueues a care job
- **WHEN** the user creates an active feed reminder at 08:00 on weekdays
- **THEN** a pending `pet.care` job exists for the next occurrence

### Requirement: Weight is stored in grams
Weight samples MUST be a positive integer `weight_g` on a `YYYY-MM-DD` day. The API MUST reject zero or negative grams with 400.

#### Scenario: Gram sample stored
- **WHEN** the user posts `weight_g` 4200 on 2026-10-13
- **THEN** the series includes that sample and later GET returns 4200

### Requirement: Notes are encrypted
Health-record notes MUST be stored only as `note_encrypted`. A successful GET or export MUST return plaintext to the owner. The database row MUST NOT contain the UTF-8 plaintext.

#### Scenario: Ciphertext is not plaintext
- **WHEN** the user creates a vet-visit record with note `阿莫西林一周`
- **THEN** the `pet_health_records` row stores a non-empty blob that is not the UTF-8 bytes of that note

### Requirement: Non-veterinary disclaimer
Every health view (today, records, calendar, and any AI care-tip text) MUST include the fixed copy `非兽医建议`.

#### Scenario: Today payload includes the notice
- **WHEN** the owner calls `GET /v1/pets/today`
- **THEN** the JSON includes a disclaimer string containing `非兽医建议`

### Requirement: Nearby services is a placeholder
The pets module MUST link nearby services to the M4 local-life route with `category=pet` and MUST NOT embed a map, service list, or M4 handler.

#### Scenario: Services page is a link-out
- **WHEN** the user opens the pets services page
- **THEN** the page shows a placeholder that links to `/modules/local?category=pet`

### Requirement: AI care tip uses the gateway seam
`POST /v1/pets/ai/care-tip` MUST call the existing `AiGateway` and MUST map an unconfigured gateway to 501 `ai_unconfigured`. The response MUST include the 非兽医建议 disclaimer when generation succeeds.

#### Scenario: Unconfigured gateway
- **WHEN** the AI gateway is unconfigured and the owner posts a care-tip request
- **THEN** the API responds 501 with error code `ai_unconfigured`
