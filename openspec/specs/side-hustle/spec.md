# side-hustle Specification

## Purpose
Shows side-hustle idea cards with 线上 / 线下 / 技能型 filters, skills-and-time suggestions with an income estimate, and a quote calculator.

## Requirements

### Requirement: Side hustle rows
The system SHALL create a `side_hustles` row from an authenticated request that includes non-empty `title` and `platform`, `estimated_income` as a non-negative integer (yuan), `skills_required` as a string array, and `kind` of `线上`, `线下`, or `技能型`. Optional `hours_per_week` SHALL be a non-negative integer. Optional client `id` SHALL be idempotent. `GET /v1/hustle/side-hustles` SHALL return the caller's rows. Optional `kind` query SHALL restrict the set.

#### Scenario: Create succeeds
- **WHEN** a signed-in client posts `{ "title": "文档翻译", "platform": "线上接单", "estimated_income": 2000, "skills_required": ["英语"], "kind": "线上" }`
- **THEN** the response is 201 and includes those fields

#### Scenario: Kind filter
- **WHEN** the owner lists with `kind=线下` after saving one 线上 and one 线下 item
- **THEN** only the 线下 item is returned

### Requirement: Suggestions use the AI seam
`POST /v1/hustle/side-hustles/suggest` SHALL require `{ "skills": string[], "hours_per_week": number }`. The handler SHALL call `AiGateway::complete`. If that returns `Unconfigured` or empty content, it SHALL return a deterministic list of at least two zh-CN suggestions derived from sorted skills and hours, each with `title`, `platform`, `estimated_income`, `skills_required`, `kind`, and a reason. The JSON SHALL include `items`, `disclaimer`, and `source`. Income figures SHALL be labeled 示意.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts `{ "skills": ["设计"], "hours_per_week": 6 }`
- **THEN** the response is 200, `source` is `mock`, and `items` has at least two entries with non-zero `estimated_income`

#### Scenario: Sorted skills are deterministic
- **WHEN** two mock suggest requests use the same hours and the same skills in different order
- **THEN** both `items` arrays are identical

### Requirement: Quote calculator
The system SHALL compute a quote sheet from `hours` (> 0), `difficulty` (1..=5), and optional `hourly_rate` (default 200 yuan). Multiplier SHALL be `0.7 + difficulty * 0.3`. Total SHALL be `round(hours * hourly_rate * multiplier)` as integer yuan. Invalid hours or difficulty SHALL be rejected in the web helper (and MUST NOT silently clamp to a wrong total).

#### Scenario: Default rate
- **WHEN** hours is 10 and difficulty is 3
- **THEN** multiplier is 1.6 and total is 3200

#### Scenario: Invalid difficulty
- **WHEN** difficulty is 0 or 6
- **THEN** the helper returns an error, not a total
