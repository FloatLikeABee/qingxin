# Spec Delta

## Purpose
Lets a person record a short mood check-in (emoji, tags, note) and review weekly or monthly trends with a tag filter.

## ADDED Requirements

### Requirement: Mood check-in
The system SHALL create a `mood_logs` row from an authenticated request that includes a catalog emoji, zero or more catalog tags, and an optional note shorter than 100 characters. The server SHALL derive a score in `1..=5` from the emoji. A missing emoji, an unknown emoji/tag, or a note of 100 or more characters SHALL return 400 `invalid_request`.

#### Scenario: Check-in succeeds
- **WHEN** a signed-in client posts `{ "emoji": "😔", "tags": ["睡眠"], "note": "夜里醒了两次" }`
- **THEN** the response is 201 and includes `id`, `emoji`, `score`, `tags`, plaintext `note`, and `created_at`

#### Scenario: Note too long
- **WHEN** a client posts a note of 100 characters
- **THEN** the response is 400 with error code `invalid_request`

#### Scenario: Check-in requires a token
- **WHEN** a client posts `/v1/mood/logs` without an Authorization header
- **THEN** the response is 401 with error code `unauthenticated`

### Requirement: List and filter
`GET /v1/mood/logs` SHALL return the caller's logs newest first. Optional `tag`, `from`, and `to` query parameters SHALL restrict the set. A client SHALL NOT see another user's logs.

#### Scenario: Owner lists own logs
- **WHEN** user A created a log and user B lists logs
- **THEN** B's list does not include A's id

#### Scenario: Tag filter
- **WHEN** the owner lists with `tag=睡眠` after logging one 睡眠 entry and one 工作 entry
- **THEN** only the 睡眠 entry is returned

### Requirement: Weekly and monthly trends
`GET /v1/mood/trends?period=week|month` SHALL return ordered points `{ date, average_score, count }` for the caller. An optional `tag` SHALL include only logs that contain that tag. Unknown `period` SHALL return 400.

#### Scenario: Weekly points
- **WHEN** the caller has two logs on the same UTC day with scores 2 and 4
- **THEN** that day's `average_score` is 3 and `count` is 2

#### Scenario: Tag-filtered trend
- **WHEN** the caller asks for `period=month&tag=工作`
- **THEN** logs without 工作 are omitted from every point
