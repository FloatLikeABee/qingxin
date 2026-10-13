# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Workbench layout
The web client SHALL render a split workbench with input on the left and streaming output on the right, plus copy, export, retry, and stop actions. Until the first output delta arrives, the output pane SHALL show a shimmer thinking state labelled 思考中.

#### Scenario: Thinking then output
- **WHEN** a user runs a tool from the workbench
- **THEN** the output pane shows 思考中 before the first chunk and later shows the streamed text with copy, export, retry, and stop controls
