# Design

## Context

See proposal.md — Why. `origin/main` is 812a3a2 (Quill PR #28). `HttpQingxinApi` already implements toolbox methods and `/modules/ai` already imports `getApi` from `#lib/api/client`. Gaps against the live tree, not a greenfield client:

- `runTool` uses `#raw`, which always sets `Accept: application/json` and never takes `AbortSignal` (`web/src/lib/api/http.ts` `#raw` / `runTool`).
- `exportUserData` maps `ai_tasks` but ignores API `templates` (`routes.rs` emits both).
- Workbench (`+page.svelte`) has 重试 and 思考中, no 停止, no in-pane error, no time buckets; `refresh()` always calls `listAiTasks()` with no `tool_id`.
- `filterTasks` sorts newest-first and filters by tool only (`history.ts`).
- No test reads `api/openapi.yaml`. OpenAPI `ToolRunRequest` omits `pdf_base64` that `RunBody` accepts. Favourite PUT 200 has no schema. SSE response has no `X-Accel-Buffering`. Persist failure after deltas sends `[DONE]` with no `event: result` (`tools.rs` `run_tool`).
- `MockQingxinApi.runTool` cannot abort between chunks.
- `e2e/api.e2e.ts` never opens `/modules/ai`.

Provider keys stay in gateway env (`DASHSCOPE_API_KEY` etc.). This change never reads them.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- Real `/v1/tools` SSE in the workbench: abort, retry, error, 思考中.
- Favourites and history persisted through the API; history browsable by time and by tool.
- Contract tests vs `api/openapi.yaml`; fix drift.
- Mock only for tests, screenshot E2E, and unset `PUBLIC_API_URL`.
- Same auth/session conventions as PR #28.

**Non-Goals:**

- Regenerating a client from OpenAPI or renaming `QingxinApi` to snake_case.
- Server-side URL fetch, PDF crate, field encryption of transcripts.
- HttpOnly cookies or `Authorization: Device` on toolbox routes (JWT Bearer only).
- Wiring finance/pets/wellness/study onto `QingxinApi`.
- Cloud deploy / Render / Netlify. Merging the PR.

**Anti-goals:**

- Query-string access tokens (log leak).
- `EventSource` (GET-only, no Authorization header).
- Shipping provider keys in the web bundle.
- Leaving M5 on `MockQingxinApi` when `PUBLIC_API_URL` is set.

## Decisions

### D1 — How `/modules/ai` reaches Axum

**Chosen:** Keep the PR #28 factory. Screens already call `getApi()` from `#lib/api/client`. Complete the HTTP toolbox methods (abort, Accept, export mapping, error frames) and the workbench states. Do not add a second client.

**Assumptions challenged against the tree:** “M5 is still on MockQingxinApi.” After 812a3a2 the page imports `client`, not `mock`. The remaining bug is incomplete HTTP streaming/UX/contracts, not the import path.

**Rejected:**

1. **Leave M5 on MockQingxinApi even when the URL is set** — two sessions; favourites never hit `templates`.
2. **Module-local `tools/api.ts` fetch wrapper (finance style)** — duplicates Bearer/refresh; `QingxinApi` already has the methods.
3. **openapi-typescript codegen** — snake_case types vs existing camelCase screens; churn on every spec edit.
4. **Vite proxy `/v1` with HTTP always** — static adapter has no proxy; screenshot E2E would hit an empty DB.

### D2 — Abort and SSE transport

**Chosen:** Extend `#raw` with `signal?: AbortSignal` and `accept?: string`. `runTool` passes `input.signal` (stripped from JSON) and `Accept: text/event-stream`. AbortError / `AbortError` name is swallowed at the iterator boundary (stop yielding). UI holds one `AbortController`; 开始/重试 abort the previous run first; 停止 aborts and sets pane to 已停止. Mock checks `signal.aborted` between chunks.

**Assumptions challenged:** `#raw` retry on 401 would replay a POST run and double-spend. Keep one refresh-and-retry (same as other methods); a run POST is not idempotent but 401-before-body is the expired-access case PR #28 already accepted.

**Rejected:**

1. **EventSource + `?access_token=`** — GET-only; tokens in logs; cannot POST `ToolRunRequest`.
2. **WebSocket `/v1/tools/ws`** — not in OpenAPI; new protocol.
3. **Required `AiGateway::stream` without default** — already landed in M5; out of scope.
4. **Fake client-side chunking after `complete`** — fails the SSE criterion and skips MockProvider.

**Grill:** *Does `fetch` abort close the Axum stream?* The spawned `run_tool` task keeps inserting a task even if `tx.send` fails. Accept persist-on-abort (history may gain a row the user stopped watching). Changing that is a product call; cost if wrong: an extra history card. *ReadableStream cancel?* Aborting fetch cancels the body; we `break` on abort. *Mock persist-before-chunks?* Mock currently inserts then yields; abort after insert still leaves a history row — same as HTTP. Leave it.

### D3 — Error states vs toast

**Chosen:** Keep toast for unexpected failures. Also set `runError` in the output pane. Parse `event: error` with `{ error: { code, message } }` as `ApiError`. HTTP 400/401/503 before bytes already throw via `#error`. Abort is not an error.

**Rejected:**

1. **Toast only** — workbench looks empty after failure; 思考中 already cleared.
2. **Throw after yielding `{ type: 'error' }`** — double handling. Throw only.
3. **Inline retry JSON-RPC** — T1 is REST + SSE.

**Grill:** *insert_task failure today sends `[DONE]` with no result.* Add `event: error` then `[DONE]`; client throws; pane shows 保存失败. Deltas already painted stay on screen plus the error.

### D4 — History by time and by tool

**Chosen:** When the history tool chip is not 全部, call `listAiTasks(toolId)` so the query string is `tool_id`. Keep newest-first. Group in the UI with `groupTasksByTime` (今天 / 本周 / 更早) using local calendar days. Do not add `since`/`until` query params in this change (YAGNI; the list is owner-scoped and small).

**Rejected:**

1. **New `from`/`to` query params** — extra OpenAPI + SQL; UI buckets do not need them yet.
2. **Client-only filter forever** — chip would lie if another device added rows; the API already supports `tool_id`.
3. **Infinite scroll calendar** — overkill for MVP history.

**Grill:** *Timezone?* Use local date (the PWA is single-user, zh-CN). Document as a builder call. *Empty 本周 heading?* Omit empty buckets.

### D5 — Contract tests and spec drift

**Chosen:** Vitest reads `api/openapi.yaml` as text (no YAML library). A `TOOLS_HTTP` table in `http.ts` lists method + path + run body keys. Tests assert each OpenAPI `/v1/tools` path exists for a table row and that every `runTool` JSON key is on `ToolRunRequest`. Fix drift in the same change:

| Drift | Fix |
|---|---|
| `pdf_base64` on `RunBody`, missing from OpenAPI | Add to `ToolRunRequest`; HTTP client may send it |
| Favourite 200 has no schema | `{ tool_id, favourite }` |
| No `X-Accel-Buffering: no` | Set on SSE response with existing `Cache-Control: no-cache` |
| Persist failure silent | `event: error` then `[DONE]` |
| Export `templates` dropped | Map to `aiTemplates` |

**Rejected:**

1. **openapi-typescript in CI** — new toolchain, snake_case types.
2. **Rust utoipa generating the YAML** — would rewrite the whole spec; out of scope.
3. **Ignore pdf_base64** — tests that post it would be undocumented.

### D6 — Keys and local-only

**Chosen:** No new env vars on the web except existing `PUBLIC_API_URL`. API keys stay in `api/crates/ai-gateway` env. Playwright API job already boots Axum with test secrets and `PUBLIC_API_URL=http://127.0.0.1:8080`. Extend `api.e2e.ts` with the toolbox flow and commit screenshots (`tools-http-*`). Screenshot suite stays mock (no env).

**Rejected:**

1. **Bundle a demo DashScope key** — anti-goal.
2. **MSW instead of Axum in e2e** — would not prove `/v1/tools`.

## Design review (self-grill)

**Proposer:** Finish the PR #28 HTTP client for M5: abortable SSE, contract tests, export mapping, workbench stop/error/time groups.

**Reviewer pushback:**

1. *“It's already wired.”* — Import path yes; Accept/abort/export/history-query/e2e/contracts no. Confirmed in `http.ts` and `+page.svelte`.
2. *Default `#raw` Accept will break SSE.* — Most servers ignore Accept; proxies and Axum extractors might not. Set the header; cheap.
3. *Abort + 401 retry duplicates runs.* — Retry only when the first response is 401, before streaming. After `body.getReader()` starts, no retry.
4. *Persisting aborted runs is surprising.* — Same as mock. Documented risk; not changing insert timing.
5. *Time buckets without API `since` is fake “through the API”.* — Tool filter is the API; time is presentation of `created_at`. Spec says newest-first + `tool_id`. Buckets do not invent a new endpoint.
6. *Contract tests that only `toContain` paths are weak.* — Table-driven method+path+body keys vs YAML; fail if a key is extra or a path missing.
7. *`event: error` is unspecified.* — Add to OpenAPI description and parse it; otherwise persist failure looks like success with no export.
8. *Shimmer never shows because mock SSE is instant.* — HTTP mock fallback still chunks 12 chars (`chunk_chars` in `tools.rs`); e2e should assert 思考中 or the result, not a race. Prefer waiting for output text that includes 示意 or 待办.
9. *writing.weekly encoding.* — `encodeURIComponent` leaves `.`; Axum `{tool_id}` matches. Covered by contract + e2e favourite/run of a dotted id if we run 周报.
10. *Empty `response.body`.* — Current code `if (!reader) return;` looks like success. Throw `unavailable` instead.
11. *Clipboard tests in e2e.* — Don't; insecure context. Copy remains unit-untested as in M5.
12. *Clippy on tools.rs.* — Only add headers + error frame; no reformat of the whole file.

**Revisions after grilling:**

- Do not add `since`/`until` query params.
- Swallow abort at the iterator; UI shows 已停止.
- Throw on missing SSE body.
- Map `templates` → `aiTemplates`.
- Document persist-on-abort as accepted.
- E2E waits for result text, screenshots the wired grid/workbench/history.

## Risks / Trade-offs

- **[Risk] Aborted run still persisted** — Mitigation: documented; later `DELETE /v1/tools/tasks/{id}` can land separately.
- **[Risk] Contract tests parse YAML as text** — Mitigation: assert on concrete path strings that already exist in the file; if OpenAPI reformats quotes, tests fail loudly.
- **[Risk] Playwright race on 思考中** — Mitigation: assert final streamed copy; screenshot after result.
- **[Risk] 401 retry of POST /run** — Mitigation: only when the status is 401 before a stream; expired access is the PR #28 case.
- **[Risk] OpenAPI vs routes.rs conflict on rebase** — Mitigation: append-only schema edits; do not reformat the YAML.

## Migration Plan

1. Land OpenSpec artifacts, tests, then implementation on `cursor/wire-m5-http-qingxin-api-6b3f`.
2. Local: `PUBLIC_API_URL=http://127.0.0.1:8080` against `cargo run`. Unset URL keeps the mock.
3. Rollback: revert the branch; factory still falls back to mock if URL unset.

## Open Questions

None that block. Persist-on-abort is a builder call (keep). Time buckets use the local calendar (builder call).
