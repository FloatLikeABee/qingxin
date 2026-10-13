# Proposal

## Why

PR #28 already selects `HttpQingxinApi` when `PUBLIC_API_URL` is set, and PR #26 already serves `/v1/tools/*`, but the M5 workbench still treats streaming as a fire-and-forget mock: no abort, no in-pane error, no OpenAPI contract tests, export drops `templates`, and history is only filtered in the browser. Issue #10's remaining product bar is a real `/v1/tools` round-trip from `/modules/ai` with SSE abort/retry/error, 思考中, and persisted favourites/history.

## What Changes

- Drive `/modules/ai` exclusively through `QingxinApi` from `#lib/api/client` (HTTP when `PUBLIC_API_URL` is set; `MockQingxinApi` only for unit tests, screenshot E2E, and unset URL).
- Complete `HttpQingxinApi` toolbox methods against `/v1/tools` using the same auth/session headers as the rest of the HTTP client (`Authorization: Bearer`, 401 refresh once).
- SSE `runTool`: `Accept: text/event-stream`, `AbortSignal`, parse `event: result` / `event: error` / `[DONE]`, surface abort vs error vs retry in the workbench with 思考中 until the first delta.
- Persist favourites via `PUT /v1/tools/{tool_id}/favourite` and history via `GET /v1/tools/tasks` (filter by `tool_id` on the API). History UI is browsable by time buckets and by tool.
- Map privacy export `templates` → `aiTemplates` (today the HTTP client drops that key).
- Add Vitest contract tests that read `api/openapi.yaml` and pin toolbox paths, methods, request fields, and auth. Fix OpenAPI/API drift (`pdf_base64`, favourite 200 body, SSE headers, error event).
- Keep provider keys in gateway env only. No cloud deploy. Playwright covers the wired flow and commits screenshots.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `api-client`: HTTP toolbox streaming (abort, SSE accept, error frames), OpenAPI contract tests, export `aiTemplates` mapping, mock remains tests/dev-only.
- `ai-toolbox`: Workbench abort / retry / error / 思考中 on the live `/v1/tools/{tool_id}/run` SSE; history browsable by time and by tool through the API.

## Impact

- `web/src/lib/api/http.ts`, `types.ts`, `mock.ts`, contract specs, `web/src/lib/tools/history.ts`, `web/src/lib/tools/store.ts`, `web/src/routes/modules/ai/+page.svelte`, `web/e2e/api.e2e.ts`.
- `api/src/tools.rs` (SSE headers, `event: error` on persist failure), `api/openapi.yaml` (request/response schemas), `api/tests/tools.rs`.
- No new npm/cargo dependencies. No `nav.ts` edits. No provider keys in the repo.
