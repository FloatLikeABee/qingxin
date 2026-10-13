# Spec Delta

## Purpose

Lets an authenticated Qingxin user pick a platform scenario, generate and polish zh-CN copy through the AiGateway seam, edit it in a dark split view with a platform-style preview, and keep versioned works.

## ADDED Requirements

### Requirement: Owner isolation
Create endpoints MUST derive the owner from the T1 AuthUser JWT and MUST NOT expose or modify another user's creations. Other users' ids MUST return 404. Missing or invalid tokens MUST return 401.

#### Scenario: Other user's creation
- **WHEN** user A requests or patches a creation id owned by user B
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a request to list or create works has no valid access token
- **THEN** the API responds 401 with error code unauthenticated

### Requirement: Platform templates
The system SHALL expose a closed catalog of platform templates for 小红书, 公众号, 抖音, and 周报. `GET /v1/create/templates` SHALL return those templates. Optional `platform` query SHALL filter to one platform. Unknown platform MUST return 400 `invalid_request`.

#### Scenario: Catalog lists four platforms
- **WHEN** an authenticated client lists templates with no filter
- **THEN** the items include at least one template for each of 小红书, 公众号, 抖音, and 周报

#### Scenario: Filter by platform
- **WHEN** an authenticated client lists templates with `platform=小红书`
- **THEN** every returned item has platform 小红书

### Requirement: Generate uses the AI seam
`POST /v1/create/generate` SHALL require an access token, `platform`, and non-empty `topic`, call `AiGateway::complete`, and fall back to deterministic zh-CN copy when Unconfigured or empty. The JSON SHALL include `text`, `disclaimer` (not professional copy advice), and `source` (`gateway` or `mock`). No provider HTTP from this handler.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts a valid generate request
- **THEN** the response is 200, `source` is `mock`, `text` is non-empty zh-CN, and `disclaimer` contains `不构成`

#### Scenario: Injected gateway is used
- **WHEN** a test double `AiGateway` returns a fixed sentence
- **THEN** the response is 200, `source` is `gateway`, and `text` is that sentence

#### Scenario: Unknown platform rejected
- **WHEN** a client posts generate with platform `微博`
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: Title generator
`POST /v1/create/titles` SHALL require an access token and a non-empty `topic`. It SHALL return exactly 10 title strings plus `disclaimer` and `source`, using the same AiGateway fallback as generate.

#### Scenario: Ten titles from a topic
- **WHEN** an authenticated client posts `{ "topic": "阳台种菜" }` with an unconfigured gateway
- **THEN** the response is 200, `titles` has length 10, each title is a non-empty string, `source` is `mock`, and `disclaimer` is present

### Requirement: Polish rewrite
`POST /v1/create/polish` SHALL require an access token, non-empty `text`, and `tone` of 更专业, 更幽默, or 更精简. It SHALL rewrite through the AiGateway seam with mock fallback and return `text`, `disclaimer`, and `source`.

#### Scenario: Humor tone mock
- **WHEN** an authenticated client posts polish with tone 更幽默 and text 今天写周报
- **THEN** the response is 200, `source` is `mock`, and `text` is different from the input and non-empty

#### Scenario: Unknown tone rejected
- **WHEN** a client posts polish with tone `更煽情`
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: Persist creations with versions
`POST /v1/create/creations` SHALL create a row from `platform`, `prompt_params`, `generated_content`, and optional `final_content` (defaulting to generated). Missing platform or empty generated_content SHALL return 400. Optional client `id` (UUID) SHALL be idempotent. Each save or polish that changes `final_content` SHALL append a version snapshot. `GET /v1/create/creations` SHALL return the caller's works newest first, including `versions`.

#### Scenario: Create succeeds
- **WHEN** a signed-in client posts `{ "platform": "小红书", "prompt_params": { "topic": "阳台种菜" }, "generated_content": "第一稿" }`
- **THEN** the response is 201 and includes `id`, `platform` 小红书, `final_content` 第一稿, and a versions array with at least one snapshot

#### Scenario: Isolation
- **WHEN** user A created a work and user B lists creations
- **THEN** B's list does not include A's id

#### Scenario: Patch appends a version
- **WHEN** the owner patches `final_content` to a new string
- **THEN** the response is 200, `final_content` is the new string, and `versions` length increased by one

### Requirement: Dark split editor
The web client SHALL render a split view with prompt configuration on one side and live preview on the other, plus a diff between generated and final copy. The editor island SHALL use a hardcoded dark IDE palette and MUST NOT inherit light page tokens. Template variables of the form `{{name}}` SHALL be highlighted.

#### Scenario: Editor stays dark in light mode
- **WHEN** the document root does not have class `dark` and the 创作 tab is open
- **THEN** the editor island background is `#0F172A` and editor text is `#E2E8F0`

#### Scenario: Diff marks an added line
- **WHEN** `diffLines` is called with previous `你好` and next `你好\n世界`
- **THEN** the result includes an `add` hunk whose text is `世界`

### Requirement: Platform-style preview
The preview pane SHALL mimic the selected platform: a 小红书 card, a 公众号 article column, a 抖音 caption frame, or a 周报 document. Preview chrome MAY stay light even when the editor island is dark.

#### Scenario: Xiaohongshu card
- **WHEN** the selected platform is 小红书 and generated copy is visible
- **THEN** the preview includes a 小红书 card surface and the generated title or body text

### Requirement: Template library one-click use
The 模板 tab SHALL list templates with platform filters, a preview of the prompt body, and a control that loads the template into the 创作 prompt config in one action.

#### Scenario: One-click use
- **WHEN** the user activates 使用 on a 公众号 template
- **THEN** the 创作 tab is selected and the prompt config platform is 公众号
