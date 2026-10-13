# Spec Delta

## Purpose
Tracks job applications on a 投递 / 面试 / Offer kanban, shows a funnel, stores interview 复盘 notes, and surfaces today's todos on home.

## ADDED Requirements

### Requirement: Application create and isolation
The system SHALL create an `applications` row from an authenticated request that includes non-empty `company` and `position`. Default `status` SHALL be `投递`. Allowed statuses are exactly `投递`, `面试`, `Offer`. Optional `interview_date` (RFC3339 or `YYYY-MM-DD`) and `notes` SHALL be stored. Optional client `id` (UUID) SHALL be idempotent. Missing company/position or an unknown status SHALL return 400 `invalid_request`. A missing token SHALL return 401 `unauthenticated`. `GET /v1/hustle/applications` SHALL return the caller's rows newest first. A client SHALL NOT see another user's applications.

#### Scenario: Create succeeds
- **WHEN** a signed-in client posts `{ "company": "轻心实验室", "position": "前端工程师" }`
- **THEN** the response is 201 and includes `id`, `status` `投递`, `company`, and `position`

#### Scenario: Unauthenticated create
- **WHEN** a client posts without an Authorization header
- **THEN** the response is 401 with error code `unauthenticated`

#### Scenario: Isolation
- **WHEN** user A created an application and user B lists applications
- **THEN** B's list does not include A's id

### Requirement: Status move and 复盘
`PATCH /v1/hustle/applications/{id}` SHALL update `status`, `interview_date`, and/or `notes` for the owner. Moving to an unknown status SHALL return 400. Notes are the interview 复盘 field.

#### Scenario: Move to 面试
- **WHEN** the owner patches `{ "status": "面试", "interview_date": "2026-10-13", "notes": "问了盒模型" }`
- **THEN** the response is 200 and those fields match

#### Scenario: Invalid status
- **WHEN** the owner patches `{ "status": "归档" }`
- **THEN** the response is 400 with error code `invalid_request`

### Requirement: Funnel
`GET /v1/hustle/funnel` SHALL return counts `{ status, count }` for `投递`, `面试`, and `Offer` for the caller, including zeros.

#### Scenario: Counts
- **WHEN** the caller has two 投递, one 面试, and zero Offer
- **THEN** the funnel lists those three counts in that column order

### Requirement: Kanban UI
The web client SHALL show three columns 投递 / 面试 / Offer. Cards SHALL be movable by HTML5 drag-and-drop and by a ≥44px status control. Dark mode SHALL apply deeper card shadows (`hustle-kanban-card`) and highlighted status tags (visible ring, brighter fill).

#### Scenario: Status control without drag
- **WHEN** a user changes a card's status control from 投递 to Offer
- **THEN** the card is listed under Offer

### Requirement: Home overview
The home route SHALL show a job-status overview (counts per status) and today's todos: applications whose `interview_date` is today, plus 投递 items without an interview date as follow-ups. Copy SHALL stay zh-CN and MUST NOT claim career advice.

#### Scenario: Today's interview appears
- **WHEN** the mock session has an application with `interview_date` equal to today
- **THEN** the home todos list includes that company and position
