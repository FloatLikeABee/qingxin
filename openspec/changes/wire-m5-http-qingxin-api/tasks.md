# Tasks

## 1. Contract tests and OpenAPI drift (tests first)

- [ ] 1.1 Write failing Vitest contract tests that read `api/openapi.yaml` and require `GET /v1/tools`, `GET /v1/tools/tasks`, `GET /v1/tools/tasks/{id}`, `PUT /v1/tools/{tool_id}/favourite`, `POST /v1/tools/{tool_id}/run`, `ToolRunRequest` fields used by `runTool` (including `pdf_base64`), and favourite 200 schema `tool_id`/`favourite`
- [ ] 1.2 Write failing HttpQingxinApi tests: runTool sends `Authorization: Bearer` + `Accept: text/event-stream` and does not put the token in the URL; abort stops the iterator; missing body throws; `event: error` becomes `ApiError`; export maps `templates` → `aiTemplates`
- [ ] 1.3 Write failing MockQingxinApi test that abort during chunks stops further deltas
- [ ] 1.4 Write failing Rust tests that SSE responses include `X-Accel-Buffering: no` and that a persist failure emits `event: error`
- [ ] 1.5 Patch `api/openapi.yaml` (pdf_base64, favourite 200 body, SSE error description) until contract tests can pass; keep append-only

## 2. HTTP client, mock abort, history helpers

- [ ] 2.1 Extend `#raw` with `signal` and `accept`; implement abortable `runTool`; map export templates; throw on missing SSE body; parse `event: error`. Watch tests go green
- [ ] 2.2 Honour `ToolRunInput.signal` in `MockQingxinApi.runTool`
- [ ] 2.3 Write failing Vitest for `groupTasksByTime` (今天 / 本周 / 更早) and implement it in `web/src/lib/tools/history.ts`

## 3. Workbench UI and API SSE hardening

- [ ] 3.1 Workbench: AbortController, 停止, in-pane error, 已停止, retry aborts in-flight first; history chips call `listAiTasks(toolId)` and render time groups; keep 思考中 shimmer
- [ ] 3.2 API: set `X-Accel-Buffering: no`; send `event: error` when `insert_task` fails; do not reformat `tools.rs`
- [ ] 3.3 Playwright `api.e2e.ts`: register, `/modules/ai`, favourite, run 摘要 through `/v1/tools`, assert output, history by tool, screenshots `tools-http-grid|workbench|history` at 390 and 1280

## 4. Verify

- [ ] 4.1 `cargo fmt --check --all`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, `cargo test --workspace` in `api/`
- [ ] 4.2 `npm test`, `npm run check`, `npm run build` in `web/`
- [ ] 4.3 Archive this OpenSpec change
