# interview-prep Specification

## Purpose
Offers a closed interview question bank filtered by role and difficulty, plus a stubbed AI mock interviewer behind `AiGateway`.

## Requirements

### Requirement: Question catalog
`GET /v1/hustle/questions` SHALL require an access token and return a closed zh-CN catalog. Optional `role` (`前端` | `后端` | `产品` | `运营`) and `difficulty` (`基础` | `进阶` | `困难`) query parameters SHALL restrict the set. Unknown filters SHALL return 400. The catalog SHALL contain at least one item per role.

#### Scenario: Filter by role
- **WHEN** the caller asks for `role=前端`
- **THEN** every item has `role` 前端 and the list is non-empty

#### Scenario: Unknown role
- **WHEN** the caller asks for `role=法务`
- **THEN** the response is 400 with error code `invalid_request`

### Requirement: Mock interviewer uses the AI seam
`POST /v1/hustle/interviews/mock` SHALL require an access token and a body `{ "question_id" }` or `{ "question" }`. The handler SHALL call `AiGateway::complete`. If that returns `Unconfigured` or empty content, it SHALL return a deterministic zh-CN follow-up derived from the question text. The JSON SHALL include `text`, `disclaimer`, `source` (`gateway` or `mock`), and the question. The disclaimer SHALL state that the text is not interview coaching. The handler SHALL NOT call any model provider HTTP API.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts a known `question_id`
- **THEN** the response is 200, `source` is `mock`, and `text` is non-empty zh-CN

#### Scenario: Same question is deterministic
- **WHEN** two mock interviewer requests use the same question text
- **THEN** both `text` values are identical
