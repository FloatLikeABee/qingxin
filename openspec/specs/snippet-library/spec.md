# snippet-library Specification

## Purpose
Gives the owner a private library of reusable phrases, quotes, and cases they can tag, insert into a draft, and rank by how often they are used.

## Requirements

### Requirement: Snippet CRUD
The system SHALL create a `snippets` row from an authenticated request that includes non-empty `content`. Optional `tags` SHALL be a list of strings. Optional `kind` SHALL be 金句, 案例, or 过渡 (default 金句). Optional client `id` (UUID) SHALL be idempotent. Empty content SHALL return 400 `invalid_request`. Unknown kind SHALL return 400. `GET /v1/create/snippets` SHALL return the caller's snippets, newest or most-used first. Cross-user ids MUST return 404.

#### Scenario: Create succeeds
- **WHEN** a signed-in client posts `{ "content": "把结论写在第一句。", "kind": "金句", "tags": ["开头"] }`
- **THEN** the response is 201 and includes that content, kind 金句, `usage_count` 0, and the tag 开头

#### Scenario: Empty content rejected
- **WHEN** a client posts `{ "content": "  " }`
- **THEN** the API responds 400 with error code `invalid_request`

#### Scenario: Isolation
- **WHEN** user A created a snippet and user B lists snippets
- **THEN** B's list does not include A's id

### Requirement: Usage count
`POST /v1/create/snippets/{id}/use` SHALL increment `usage_count` by 1 for the owner and return the updated snippet. It MUST NOT increment another user's snippet.

#### Scenario: Use increments
- **WHEN** the owner uses a snippet that had `usage_count` 0
- **THEN** the response is 200 and `usage_count` is 1
