# Spec Delta

## ADDED Requirements

### Requirement: Study pages use the real API through reactive stores
The study web app SHALL load and mutate challenges, flashcards, notes, and skills only through `getApi()`. Stores SHALL use `$state`. Skill templates SHALL come from `GET /v1/study/skills/templates` (not a client-only catalog). Flashcard review SHALL POST the server grade enum and use the returned card.

#### Scenario: API-seeded challenges appear
- **WHEN** study challenges exist for the user on the API
- **THEN** `/study` renders them instead of the empty state

#### Scenario: Challenge length
- **WHEN** the user creates a study challenge
- **THEN** `target_days` is one of 7, 14, or 21

#### Scenario: Check-in updates streak
- **WHEN** the user creates a 21-day challenge and checks in today
- **THEN** the API stores the check-in and the UI shows streak 1

#### Scenario: Templates come from the server
- **WHEN** the user copies a skill tree template
- **THEN** the client POSTs `template_id` from the server template list, not a hardcoded local tree
