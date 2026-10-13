# Spec Delta

## ADDED Requirements

### Requirement: Export includes study records
`GET /v1/privacy/export` SHALL include a `study` object with the caller's challenges (and check-ins), flashcards (front/back decrypted), notes (Markdown decrypted), skill nodes, and reminders.

#### Scenario: Export lists the caller's study
- **WHEN** an authenticated user who has a challenge check-in and a note calls `GET /v1/privacy/export`
- **THEN** the response is 200 and `study.challenges` contains that challenge and `study.notes` contains the plaintext Markdown

### Requirement: Account deletion removes study rows
`DELETE /v1/privacy/account` MUST delete the user so that no `study_*` rows remain for that user_id (via foreign-key cascade or an explicit hook).

#### Scenario: Account deleted
- **WHEN** the user deletes their account after creating study rows
- **THEN** the response is 204 and no study_challenges, study_checkins, study_flashcards, study_notes, study_skill_nodes or study_reminders rows remain for that user
