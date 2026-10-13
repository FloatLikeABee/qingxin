# ai-toolbox Specification

## Purpose
Gives an authenticated Qingxin user a private AI productivity toolbox: a grid of recent and favourite tools, a split workbench that streams answers, and history of past runs, all through the existing AI gateway seam.

## Requirements

### Requirement: Owner isolation
Toolbox endpoints MUST derive the owner from the T1 AuthUser JWT and MUST NOT expose or modify another user's tasks or templates. Other users' ids MUST return 404. Missing or invalid tokens MUST return 401.

#### Scenario: Other user's task
- **WHEN** user A requests a task id owned by user B
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a request to list tools or run a tool has no valid access token
- **THEN** the API responds 401 with error code unauthenticated

### Requirement: Tool catalog with recent and favourites
`GET /v1/tools` SHALL require an access token and SHALL return a closed catalog of tools: `summary`, `meeting`, `writing.weekly`, `writing.daily`, `writing.xhs`, `polish`, `resume_jd`, and `rename`. The JSON SHALL include `items`, `recent` (tool ids from the caller's `ai_tasks`, newest last-used first), and `favourites` (tool ids the caller marked via `templates`).

#### Scenario: Catalog lists eight tools
- **WHEN** an authenticated client lists tools
- **THEN** `items` includes those eight ids and each item has `id`, `name`, and `favourite`

#### Scenario: Recent reflects last run
- **WHEN** the caller has run `summary` more recently than `polish`
- **THEN** `recent` lists `summary` before `polish`

#### Scenario: Favourite is persisted
- **WHEN** the caller PUTs favourite true for `meeting` and lists tools again
- **THEN** `favourites` includes `meeting` and that item's `favourite` is true

### Requirement: Unknown tool rejected
Unknown `tool_id` values MUST return 400 `invalid_request`. Empty required input MUST return 400 `invalid_request`. Input text longer than 32000 characters MUST return 400 `invalid_request`.

#### Scenario: Unknown tool id
- **WHEN** a client posts a run to tool id `translate`
- **THEN** the API responds 400 with error code `invalid_request`

#### Scenario: Empty summary text
- **WHEN** a client runs `summary` with empty `text` and no `url`
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: Summary with todos
`POST /v1/tools/summary/run` SHALL accept `input_kind` of `text`, `url`, or `pdf`. It SHALL call the AI seam and persist an `ai_tasks` row. The streamed text and `output_json` SHALL include a summary and a `todos` array. URL input MUST NOT cause the server to fetch the URL. PDF input SHALL use extracted text plus optional `filename`.

#### Scenario: Text summary mock
- **WHEN** `AppState.ai` is unconfigured and a client runs summary with non-empty text
- **THEN** the SSE body contains a non-empty summary, a `todos` list, `source` mock, and a disclaimer containing `不构成`

#### Scenario: URL is not fetched
- **WHEN** a client runs summary with `input_kind` url and `url` `https://example.com/notes`
- **THEN** the task is stored with that url in metadata and the handler does not open a TCP connection to example.com

#### Scenario: PDF filename is recorded
- **WHEN** a client runs summary with `input_kind` pdf, `filename` `notes.pdf`, and extracted text
- **THEN** the stored task metadata includes `notes.pdf` and the output includes todos

### Requirement: Meeting assistant is two-step
`POST /v1/tools/meeting/run` SHALL accept a transcript. Default `step` is `topics`. A second run with `step` `decisions` SHALL require topics (from the body or the caller's latest meeting task) and SHALL add decisions. Both steps persist `ai_tasks` rows.

#### Scenario: Topics from transcript
- **WHEN** an authenticated client runs meeting with a non-empty transcript and no step
- **THEN** the output includes a non-empty `topics` array

#### Scenario: Decisions need topics
- **WHEN** a client runs meeting with `step` `decisions` and neither body topics nor a prior meeting task
- **THEN** the API responds 400 with error code `invalid_request`

#### Scenario: Decisions follow topics
- **WHEN** the caller has a meeting topics task and then runs `step` `decisions`
- **THEN** the output includes both `topics` and a non-empty `decisions` array

### Requirement: Writing tools and polish
`writing.weekly`, `writing.daily`, and `writing.xhs` SHALL turn notes into zh-CN 周报, 日报, or 小红书 copy. `polish` SHALL require non-empty `text` and optional `tone` of `更专业`, `更幽默`, or `更精简`. All four SHALL use the AI seam with mock fallback.

#### Scenario: Weekly report mock
- **WHEN** an authenticated client runs `writing.weekly` with notes about a shipped feature
- **THEN** the output text is non-empty zh-CN and mentions 周报

#### Scenario: Unknown polish tone
- **WHEN** a client runs polish with tone `更煽情`
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: Resume versus JD match
`POST /v1/tools/resume_jd/run` SHALL require non-empty `resume` and `jd`. The output JSON SHALL include a numeric `score` from 0 to 100, `matches`, `gaps`, and a disclaimer that this is not career advice.

#### Scenario: Match returns a score
- **WHEN** an authenticated client runs resume_jd with a resume and a job description
- **THEN** the response includes `score` between 0 and 100, arrays `matches` and `gaps`, and a disclaimer containing `不构成`

#### Scenario: Missing JD rejected
- **WHEN** a client runs resume_jd with only a resume
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: File-rename suggestions
`POST /v1/tools/rename/run` SHALL require a non-empty `filenames` array of strings. The output JSON SHALL include `suggestions` objects with `original`, `suggested`, and `reason`.

#### Scenario: Suggestions for two files
- **WHEN** an authenticated client runs rename with filenames `会议 最终 final (1).docx` and `IMG_0001.jpg`
- **THEN** `suggestions` has length 2 and each `suggested` is a non-empty string different from a messy original when the mock path runs

### Requirement: SSE workbench run
Each `POST /v1/tools/{tool_id}/run` SHALL return `text/event-stream`. Frames SHALL include OpenAI-compatible `data:` deltas, then an `event: result` payload with the saved task id, `source` (`gateway` or `mock`), and `disclaimer`, then `data: [DONE]`. The handler MUST call `AiGateway::stream` (or `complete` via the default stream). It MUST NOT call a vendor HTTP client. Unconfigured or empty gateway output SHALL stream the deterministic mock instead of 501.

#### Scenario: Unconfigured gateway streams mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts a valid summary run
- **THEN** the response is 200, `Content-Type` is `text/event-stream`, the body contains `data:`, `event: result`, `source` mock, and `[DONE]`

#### Scenario: Injected gateway is used
- **WHEN** the process uses `QingxinAiGateway::mock` with fixed text and a client runs polish
- **THEN** the SSE deltas concatenate to that text and `source` is `gateway`

#### Scenario: Run persists a task
- **WHEN** a valid run completes
- **THEN** `GET /v1/tools/tasks` includes a new row for that tool with the input and output

### Requirement: History by time and tool
`GET /v1/tools/tasks` SHALL return the caller's `ai_tasks` newest first. Optional `tool_id` SHALL filter to one catalog tool. Unknown `tool_id` MUST return 400.

#### Scenario: Newest first
- **WHEN** the caller ran polish then summary
- **THEN** the first task in the list has tool_id `summary`

#### Scenario: Filter by tool
- **WHEN** the caller lists tasks with `tool_id=meeting`
- **THEN** every item has tool_id `meeting`

### Requirement: Workbench layout
The web client SHALL render a split workbench with input on the left and streaming output on the right, plus copy, export, retry, and stop actions. Until the first output delta arrives, the output pane SHALL show a shimmer thinking state labelled 思考中.

#### Scenario: Thinking then output
- **WHEN** a user runs a tool from the workbench
- **THEN** the output pane shows 思考中 before the first chunk and later shows the streamed text with copy, export, retry, and stop controls

### Requirement: Templates back favourites
`templates` rows SHALL be owner-scoped. Toggling favourite MUST upsert a row for that `user_id` and `tool_id`. Built-in prompt bodies for writing tools MAY be stored on the row. Client UUID `id` on create is not required.

#### Scenario: Toggle favourite twice
- **WHEN** the owner favourites `summary` then favourites it again with false
- **THEN** `GET /v1/tools` no longer lists `summary` under `favourites`

### Requirement: Workbench abort retry and error on live SSE
The `/modules/ai` workbench SHALL call `QingxinApi.runTool` (HTTP against `POST /v1/tools/{tool_id}/run` when `PUBLIC_API_URL` is set). It SHALL show 思考中 with the shimmer until the first delta. It SHALL offer 停止 that aborts the in-flight stream, 重试 that replays the last payload, and an in-pane error state (not only a toast) for HTTP/SSE failures. Abort MUST NOT look like a server failure. Copy / export remain available after a successful result.

#### Scenario: Thinking then output on HTTP
- **WHEN** a signed-in user with `PUBLIC_API_URL` set runs 摘要 from the workbench
- **THEN** the output pane shows 思考中 before the first chunk and later shows streamed text from `/v1/tools/summary/run`

#### Scenario: Stop aborts the run
- **WHEN** a run is in 思考中 or streaming and the user clicks 停止
- **THEN** the client aborts the fetch, streaming stops, and the pane shows 已停止 rather than 没能完成

#### Scenario: Error stays in the pane
- **WHEN** `runTool` rejects (400/401/503 or `event: error`)
- **THEN** the output pane shows the error message and 重试 stays enabled

### Requirement: History browsable by time and tool through the API
Favourites SHALL persist through `PUT /v1/tools/{tool_id}/favourite`. History SHALL load through `GET /v1/tools/tasks` (passing `tool_id` when a tool chip is selected) and SHALL be grouped in the UI by time (今天, 本周, 更早) as well as filterable by tool. Offline, the last cached catalog and tasks remain readable.

#### Scenario: Favourite round-trip
- **WHEN** a signed-in HTTP user favourites 会议助手 and reloads `/modules/ai`
- **THEN** 已收藏 includes 会议助手 from the API catalog

#### Scenario: Filter by tool hits the API
- **WHEN** the history tab selects 摘要
- **THEN** the client requests `/v1/tools/tasks?tool_id=summary` and the list only shows summary rows

#### Scenario: Grouped by time
- **WHEN** history contains a task from today and one from last month
- **THEN** the list shows headings 今天 and 更早 with those tasks under the matching heading
