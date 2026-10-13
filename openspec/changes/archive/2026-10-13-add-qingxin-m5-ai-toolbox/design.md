# Design

## Context

See proposal.md — Why. Issue #10, the Notion M5 card, and the user brief agree: build the last open MVP module on merged T1 API + AI gateway (complete, `stream`, MockProvider, `encode_sse`) + T2 shell, reuse kit/tokens/IndexedDB/`QingxinApi`, stream the workbench, and never call vendors from this module.

The live tree already has `api/` (Axum 0.8, SQLx, `AiGateway::complete` only) and `web/` (SvelteKit 5, kit, themes, mock client). `/modules/ai` is the `[slug]` placeholder. `/v1/ai/complete` is the T1 completion seam — M5 HTTP must not replace it. M9 writing/polish lives at `/v1/create` and `/modules/create`; this module is the generic toolbox. Latest migration on `main` is `0010_create.sql`. `Tabs` is hardcoded to `grid-cols-3`. `EventSource` is GET-only. `ai-gateway` already streams OpenAI-compatible SSE.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- A complete M5 MVP a person can use offline-first in zh-CN on a 390px phone and a 1280px desktop.
- Tests first for catalog, isolation, each tool, SSE framing, mock fallback, MockProvider path, privacy export, history filters, and the typed mock client.
- Screenshots at 390/1280 × light/dark of the M5 screens (工具, 工作台, 历史).

**Non-Goals:**

- Real DashScope/Zhipu/Kimi/Ollama HTTP from this module (the gateway crate already owns providers).
- Server-side URL fetch, a PDF parsing crate, object storage, or file bytes on disk.
- Publishing to 小红书, a second editor/theme engine, or merging M5 into M9.
- Cloud deploy / Render / Netlify / Vercel config.
- Merging the PR (PO merges).
- Changing `POST /v1/ai/complete` behaviour.

**Anti-goals:**

- Putting toolbox routes under a path that shadows `/v1/ai/complete`.
- Editing `web/src/lib/nav.ts`.
- Reformatting `routes.rs` or `openapi.yaml`.
- Returning 501 for toolbox runs when the gateway is unconfigured (the workbench *is* the product).

## Decisions

### D1 — Persistence

**Chosen:** Two tables matching the issue contract — `ai_tasks` and `templates` — TEXT UUID PKs, TEXT RFC3339 timestamps, `ON DELETE CASCADE` from `users`.

`ai_tasks`: `id`, `user_id`, `tool_id`, `input_kind`, `input_text`, `input_meta` (JSON TEXT: url, filename, resume, jd, filenames, step, topics, tone), `output_text`, `output_json` (JSON TEXT), `source`, `created_at`. Index `(user_id, created_at DESC)` and `(user_id, tool_id, created_at DESC)`.

`templates`: `id`, `user_id`, `tool_id`, `title`, `body`, `favourite` (INTEGER 0/1), `created_at`, `updated_at`, UNIQUE `(user_id, tool_id)`. Favourites and optional writing prompt bodies live here. The eight-tool catalog stays in code; listing merges catalog + the caller's template rows.

**Assumptions challenged against the tree:** T1 export today lists profile/consents/devices/jobs/push/mood/hustle/finance/wellness/local/create — M5 must extend that or transcripts vanish from 导出. `/v1/ai` is already the gateway. Create used a single `create.rs`; tools follow that (one file), not more SQL in `routes.rs`.

**Rejected:**

1. **JSON blob column on `users`** — cannot list history by tool, export becomes opaque.
2. **IndexedDB-only (no API tables)** — issue names the two tables and says extend the T1 contract.
3. **A generic `ugc_entries` bag** — M1 already chose dedicated tables.
4. **Rename `templates` to `ai_templates`** — the card names `templates`; indexes and OpenAPI keys (`templates` / `ai_tasks`) keep it scoped.

### D2 — HTTP prefix

**Chosen:** `/v1/tools` for catalog, `/{tool_id}/favourite`, `/{tool_id}/run`, and `/tasks`. Matches “toolbox”, leaves T1 `/v1/ai/complete` untouched, and matches how M9 refused `/v1/ai/*` for create. UI slug stays `ai` at `/modules/ai`.

**Rejected:**

1. **`/v1/ai/tasks` siblings of complete** — readable, but one OpenAPI tag and one prefix already mean “raw completion seam”. A mistaken `{tool_id}=complete` router is too cute by half.
2. **`/v1/ai-tools` or `/v1/toolbox`** — extra punctuation; other modules match a single English noun (`create`, `hustle`, `mood`).
3. **GraphQL / JSON-RPC one-shot** — T1 is Axum REST + OpenAPI.
4. **One `POST /v1/ai/complete` with `tool` in the body** — would overload Echo’s seam and mix accounting prompts with product tools.

### D3 — Streaming seam

**Chosen:** Add `AiGateway::stream` returning a boxed stream of `StreamChunk::{Delta, End}`. Default method calls `complete` and yields one delta + end, so every existing `FixedGateway` in mood/hustle/create/study tests keeps compiling. `QingxinAiGateway` overrides with `Gateway::stream_for_user` (new thin map next to `complete_for_user`) and the HTTP handler uses `qingxin_ai_gateway::encode_sse` for deltas, then `event: result` with the persisted task, then `data: [DONE]`. Unconfigured / empty → deterministic mock streamed as deltas (not 501). Client uses `fetch` + `ReadableStream` (or the mock async iterator). Never `EventSource` (GET-only).

**Rejected:**

1. **Required stream method with no default** — would break every in-tree `impl AiGateway for FixedGateway`.
2. **Fake SSE only on the client after `complete`** — fails the card’s SSE criterion and skips MockProvider stream tests.
3. **New `AiStreamer` trait** — two injections for one product.
4. **Change `/v1/ai/complete` into SSE** — breaks T1 JSON clients and M1/M9 callers.

### D4 — URL and PDF input

**Chosen:** First-class `input_kind` `text` | `url` | `pdf`. Cap `input_text` at 32_000 chars. **Do not fetch URLs** (SSRF; `qingxin-api` has no `reqwest`). Store `url` in `input_meta` and put it in the prompt. PDF: store `filename` plus extracted text. If `input_text` (or optional `pdf_base64`) starts with `%PDF`, a tiny parenthesis/`Tj` scraper pulls Latin/CJK strings — no new crate. The web file input reads `.txt` via `File.text()` and sends `.pdf` name plus any extracted/pasted text.

**Rejected:**

1. **Server `reqwest::get(url)`** — SSRF to cloud metadata and flaky CI. `qingxin-api` Cargo.toml has no HTTP client on purpose.
2. **`pdf-extract` / `lopdf` crate** — extra native weight for MVP; tests can ship a 6-line `%PDF` fixture.
3. **Store PDF bytes in SQLite or Blobs** — ephemeral disk, export bloat, not asked.
4. **Ignore PDF/URL and only accept paste** — fails the card.

### D5 — Tool prompts and structured JSON

**Chosen:** Closed catalog in `api/src/tools.rs` and `web/src/lib/tools/catalog.ts`:

| id | name | extra fields |
|---|---|---|
| `summary` | 摘要 | `input_kind`, todos in `output_json` |
| `meeting` | 会议助手 | `step`: `topics` (default) then `decisions` |
| `writing.weekly` | 周报 | notes → copy |
| `writing.daily` | 日报 | notes → copy |
| `writing.xhs` | 小红书 | notes → copy |
| `polish` | 润色 | `tone` in {更专业, 更幽默, 更精简} |
| `resume_jd` | 简历对照 | `resume` + `jd` |
| `rename` | 文件命名 | `filenames[]` |

Each run builds a zh-CN instruction + user payload, model id `qingxin-tools`. Mock fallback is a pure function of the inputs (stable for tests). Gateway text is used as `output_text`; if it parses as JSON, merge into `output_json`, else wrap `{ "text": ... }` and still fill mock-shaped keys when missing (e.g. empty todos stay `[]` only on mock). Always `disclaimer` containing `不构成`. Writing tools do **not** call `/v1/create/*`.

Meeting: first run stores topics; decisions reads `body.topics` or the latest `meeting` task’s `output_json.topics`. Missing topics → 400.

**Rejected:**

1. **Reuse M9 generate/polish HTTP** — different module, different UX (SSE workbench vs dark editor), would couple ship trains.
2. **One `tool=generic` with free-form system prompts from the client** — prompt injection as a product feature; catalog must stay closed.
3. **Always 501 until a human wires copy** — M7 OCR can 501 because paste still works; here run *is* the product.
4. **LLM-as-JSON with no mock schema** — MockProvider returns a sentence; tests need deterministic todos/score/suggestions.

### D6 — Workbench UI

**Chosen:** `/modules/ai` with three kit tabs: 工具 / 工作台 / 历史. 工具: full grid + 最近使用 + 已收藏. Clicking a tool sets `tool_id` and switches to 工作台. 工作台: CSS grid `md:grid-cols-2`, input left, output right; on 390px they stack (input first). Output uses kit `Skeleton` plus a `.qx-shimmer` gradient until the first delta (`aria-busy`, visible 思考中). Actions: 复制 (clipboard), 导出 (`.md` download), 重试 (same payload). 历史: chips for all tools plus 全部, list newest first. `[slug]/+page.ts` excludes `ai`. No `nav.ts`. No home card (card does not name Home).

**Rejected:**

1. **Nested `/modules/ai/[tool]` routes** — extra jumps on a phone; M1/M10 keep one module URL.
2. **Five kit tabs** — `Tabs` is `grid-cols-3`.
3. **Force a second bottom-nav item** — T2 chrome is 首页 / 模块 / 组件 / 我的.
4. **Monaco / markdown preview library** — kit Textarea + Card is enough.
5. **EventSource** — cannot POST JSON or Authorization.

### D7 — Encryption, moderation, secrets

**Chosen:** Do not AES-GCM toolbox rows (same as hustle/create). Owner-scoped via JWT. Export returns plaintext for the owner. `Moderator` is not invoked (output is the user’s own prompt). Keys stay in gateway env (`DASHSCOPE_API_KEY` etc.); this module never reads them. No `.env` sample with real keys. No deploy files.

**Rejected:**

1. **Encrypt `input_text` / `output_text`** — card does not ask; history list would decrypt every row. Meeting transcripts are sensitive: accepted risk, documented below.
2. **Client-only encryption** — mixing schemes with T1 `FieldCrypto` is worse.
3. **Run `Moderator` on every run** — T1 moderation is a no-op stub.

### D8 — Shared-file strategy and migration number

**Chosen:** Migration `0011_ai_tools.sql`. Shared hunks append-only: `pub mod tools` in `lib.rs`; `.merge(crate::tools::routes())` in `routes.rs`; export keys `ai_tasks` / `templates`; OpenAPI tag `Tools` + paths immediately before `components:` + schemas at EOF; `[slug]` filter adds `ai`. `futures` in `qingxin-api` for the stream type. If another module claims `0011` on main before this PR lands, rename without changing SQL. Do not reformat `routes.rs` / `openapi.yaml`. Do not touch `nav.ts`.

**Rejected:**

1. **`0006`/`0010` reuse** — already taken.
2. **Folder `api/src/tools/` like wellness** — eight handlers still fit one file; split only if clippy complexity demands it (then extract helpers in the same module).
3. **A real HTTP `QingxinApi` now** — the PWA mock is the live client, same as M1–M9.

## Design review (self-grill)

**Proposer:** Thin module: two tables, stream-through-gateway, kit workbench, mock fallback, append-only shared files.

**Reviewer pushback:**

1. *A deterministic summary will be mistaken for a model.* — Label 示意, always `disclaimer` with `不构成`, `source: mock` unless a gateway actually answered.
2. *Default `stream` that wraps `complete` is not “SSE streaming”.* — HTTP still emits `text/event-stream`. `QingxinAiGateway::mock` uses MockProvider’s `chat_stream`. Tests cover both Unconfigured (chunked mock) and MockProvider (gateway source).
3. *URL-without-fetch is a fake summarizer.* — True. Fetching is an SSRF footgun the API crate is not equipped for. The prompt includes the URL; users paste page text. Card is satisfied by `input_kind=url` being stored and rendered.
4. *PDF scraper is not a parser.* — Sufficient for a `%PDF` fixture and filename UX. A crate can wait.
5. *Meeting two-step will confuse.* — Workbench shows 生成议题 then 生成决策; 400 if decisions has no topics.
6. *M9 already writes 周报 and 小红书 and polish.* — Different route, different layout, different persistence (`ai_tasks` vs `creations`). Do not import `create.rs`.
7. *`templates` table name collides conceptually with create/study templates.* — SQL name is what the card said; HTTP is `/v1/tools`. Export key `templates` next to `ai_tasks` is unambiguous in that object.
8. *Extending `AiGateway` will fail clippy on unused default.* — Default is used by every FixedGateway through toolbox tests; `complete` path stays covered by foundation.rs.
9. *SSE + oneshot tests deadlock.* — MockProvider streams are finite and in-process; `to_bytes` works in create/foundation tests already.
10. *32k cap is arbitrary.* — Gateway timeout is 30s; a novel-length paste would hang the workbench. Cap is a product choice, tested.
11. *Retry without idempotency doubles token spend.* — Retry is a new run (new `ai_tasks` id). History keeps both. Not a bug.
12. *Shimmer that is only `animate-pulse` is not shimmer.* — Add a CSS gradient `qx-shimmer` on the output card; Skeleton stays for structure.
13. *Favourite upsert races.* — UNIQUE `(user_id, tool_id)` plus `ON CONFLICT DO UPDATE`.
14. *Clipboard in insecure context.* — Copy falls back to `textarea.select()`; tests cover the export string, not `navigator.clipboard`.
15. *Home clutter.* — No home card. Hub is enough.
16. *EventSource with a query token leaks JWTs in logs.* — Another reason to POST + fetch.
17. *Gateway rate limit will 503 the workbench.* — Map `AiError::Failed` to 503 `unavailable` JSON, not a hung SSE, when stream setup fails before the first byte. After the first delta, emit an SSE error comment and end.

**Revisions after grilling:**

- HTTP lives under `/v1/tools`, never a replacement of `/v1/ai/complete`.
- `stream` on `AiGateway` with a complete-based default; `stream_for_user` on the crate Gateway.
- Unconfigured toolbox runs stream mock copy (not 501).
- No URL fetch, no PDF crate, 32k input cap.
- Three tabs on one route; no `nav.ts`; no home card.
- Do not encrypt toolbox rows; export/delete include both tables.
- Migration `0011_ai_tools.sql`; renumber if main moved.
- Result trailer is `event: result` so the client gets the task id without a second GET.
- `futures` dependency on `qingxin-api` only.

## Risks / Trade-offs

- **[Risk] Meeting transcripts and resumes sit plaintext** — Mitigation: owner JWT isolation, cascade delete, export only to the owner; encryption can land later without changing HTTP.
- **[Risk] Echo’s `stream` shape drifts** — Mitigation: `stream_for_user` is a one-file map like `complete_for_user`; HTTP uses public `encode_sse`.
- **[Risk] Gateway returns prose instead of JSON todos** — Mitigation: mock path always fills `output_json`; gateway path keeps `output_text` and best-effort JSON parse.
- **[Risk] OpenAPI / routes.rs conflict** — Mitigation: append-only hunks; rebase onto latest main before opening the PR.
- **[Risk] SSE clients buffer the whole body** — Mitigation: `Cache-Control: no-cache` and `X-Accel-Buffering: no`; mock iterator yields microtasks so the UI can paint 思考中.
- **[Risk] Rate-limit mid-retry** — Mitigation: surface 503 with `unavailable`; retry button stays enabled.
- **[Risk] Clippy on a growing `tools.rs`** — Mitigation: keep handlers there; extract prompt/mock pure fns at the top.

## Migration Plan

1. Land OpenSpec artifacts, then tests, then implementation on `cursor/m5-ai-toolbox-3cc7`.
2. Echo’s live gateway already sits behind `QingxinAiGateway::from_env()`; toolbox AI starts returning `source: gateway` when stream succeeds, with no UI rewrite.
3. A later HTTP `QingxinApi` implements the same methods from OpenAPI using `fetch` streams.
4. Rollback: revert the branch; drop `0011_ai_tools.sql` on empty local DBs.

## Open Questions

None that block M5. Server-side URL fetch with an allowlist, a real PDF crate, and field encryption for transcripts wait for later polish.
