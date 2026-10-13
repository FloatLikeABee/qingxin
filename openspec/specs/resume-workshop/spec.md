# resume-workshop Specification

## Purpose
Lets a person edit a resume in a form, keep multiple versions, preview an always-light A4 page, export via print-to-PDF, and request a stubbed AI rewrite through `AiGateway`.

## Requirements

### Requirement: Resume versions
The system SHALL create a `resumes` row from an authenticated request that includes JSON content with a non-empty `name`. Each create for a user SHALL assign the next integer `version`. Optional client `id` (UUID) SHALL be idempotent. A missing name SHALL return 400 `invalid_request`. `GET /v1/hustle/resumes` SHALL return the caller's resumes newest first. `PATCH /v1/hustle/resumes/{id}` SHALL update `content_json` and optional `title` for the owner only. `pdf_url` MAY be null.

#### Scenario: Create succeeds
- **WHEN** a signed-in client posts `{ "content": { "name": "林轻心", "title": "前端工程师" } }`
- **THEN** the response is 201 and includes `id`, `version` `1`, `content.name` `林轻心`, and `pdf_url` null

#### Scenario: Second version increments
- **WHEN** the same user creates another resume
- **THEN** `version` is `2`

#### Scenario: Name required
- **WHEN** a client posts content without `name`
- **THEN** the response is 400 with error code `invalid_request`

#### Scenario: Isolation
- **WHEN** user A created a resume and user B lists resumes
- **THEN** B's list does not include A's id

### Requirement: Always-light A4 preview
The web client SHALL render a live A4 preview (210mm × 297mm logical page) from the form. The preview element SHALL use a hardcoded light palette and MUST NOT inherit `html.dark` tokens. Dark mode around the preview SHALL still apply to the rest of the module chrome.

#### Scenario: Preview stays light in dark mode
- **WHEN** the document root has class `dark` and the resume tab is open
- **THEN** the A4 preview background is white (`#FFFFFF`) and body text is dark (`#1F2937`)

### Requirement: PDF export
The web client SHALL offer 导出 PDF that prints the A4 island. The printable HTML SHALL include the light palette so print-to-PDF does not pick up dark tokens.

#### Scenario: Printable HTML is light
- **WHEN** `resumeToPrintableHtml` is called with a named resume
- **THEN** the HTML contains the name and `#FFFFFF`

### Requirement: Optimize uses the AI seam
`POST /v1/hustle/resumes/{id}/optimize` SHALL require an access token, load the owner's resume, and call `AiGateway::complete`. If that returns `Unconfigured` or empty content, the handler SHALL return a deterministic zh-CN rewrite derived from name and title. The JSON SHALL include `text`, `disclaimer`, and `source` (`gateway` or `mock`). The disclaimer SHALL state that the text is not career advice. The handler SHALL NOT call any model provider HTTP API.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts a valid optimize request
- **THEN** the response is 200, `source` is `mock`, `text` is non-empty zh-CN, and `disclaimer` contains `不构成`

#### Scenario: Injected gateway is used
- **WHEN** a test double `AiGateway` returns a fixed sentence
- **THEN** the response is 200, `source` is `gateway`, and `text` is that sentence
