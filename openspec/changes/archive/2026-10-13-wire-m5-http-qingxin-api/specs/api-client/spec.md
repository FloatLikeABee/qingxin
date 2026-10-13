# Spec Delta

## ADDED Requirements

### Requirement: HTTP toolbox uses live /v1/tools
`HttpQingxinApi` SHALL implement toolbox methods by calling the OpenAPI `/v1/tools` operations with the same session headers as other HTTP methods: `Authorization: Bearer` from `qingxin.session`, JSON `Content-Type` on bodies, and a single 401 refresh-and-retry. `runTool` SHALL set `Accept: text/event-stream` and SHALL NOT put the access token in the query string.

#### Scenario: Run sends Bearer and SSE Accept
- **WHEN** a stored session exists and `runTool` is called for `summary`
- **THEN** the POST to `/v1/tools/summary/run` includes `Authorization: Bearer` with the access token and `Accept: text/event-stream`

### Requirement: Toolbox stream abort and error frames
`AbortSignal` on `ToolRunInput` SHALL abort the fetch and stop yielding. `event: error` frames SHALL become `ApiError`. Privacy export SHALL map API `templates` to `aiTemplates` in addition to `ai_tasks` → `aiTasks`.

#### Scenario: Abort stops the stream
- **WHEN** `runTool` is iterating deltas and the input `signal` is aborted
- **THEN** the client stops yielding further events and does not throw an `unavailable` network error

#### Scenario: Export maps templates
- **WHEN** the API export JSON includes a `templates` array with a favourite row
- **THEN** `exportUserData().data.aiTemplates` contains that row with camelCase fields

#### Scenario: SSE error frame
- **WHEN** the run stream emits `event: error` with JSON `{ "error": { "code": "unavailable", "message": "保存失败" } }`
- **THEN** `runTool` throws `ApiError` whose `code` is `unavailable`

### Requirement: OpenAPI contract tests for toolbox
The web test suite SHALL parse `api/openapi.yaml` and assert that every toolbox method on `HttpQingxinApi` matches a documented path, HTTP method, and (for run) request body field names. Tests SHALL fail if the client sends a field the spec does not declare, or if a documented `/v1/tools*` operation has no client method.

#### Scenario: Documented tools paths have client methods
- **WHEN** the contract tests read `api/openapi.yaml`
- **THEN** they require `GET /v1/tools`, `GET /v1/tools/tasks`, `GET /v1/tools/tasks/{id}`, `PUT /v1/tools/{tool_id}/favourite`, and `POST /v1/tools/{tool_id}/run`

#### Scenario: Run body fields stay in spec
- **WHEN** `HttpQingxinApi.runTool` JSON-encodes a payload
- **THEN** every encoded key exists on `components.schemas.ToolRunRequest` (including `pdf_base64` when sent)

## MODIFIED Requirements

### Requirement: Toolbox operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list tools (with recent and favourites), toggle favourite, list tasks filtered by tool, and run a tool as an async stream of deltas plus a final task. `ToolRunInput` MAY include an `AbortSignal` that implementations MUST honour and MUST NOT serialise onto the wire. Screens SHALL depend on that interface, not a concrete HTTP client. Export SHALL include `aiTasks` and `aiTemplates`.

#### Scenario: Interface covers M5 operations
- **WHEN** a caller uses the API client
- **THEN** it can list eight tools, favourite one, run summary, abort a run, and list tasks by tool

#### Scenario: Mock enforces tool catalog
- **WHEN** the mock client runs tool id `translate`
- **THEN** it rejects with a typed `invalid_request` error

#### Scenario: Mock honours abort
- **WHEN** the mock `runTool` is iterating and the input signal aborts
- **THEN** it stops yielding further deltas
