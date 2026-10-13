# Design

## Context

Issue #9, Notion card [M1 情绪日记 + 冥想](https://app.notion.com/p/3f8469841e1f8128ae22d8a115394bdb), and the user brief agree: build the module on merged T1/T2, reuse kit/tokens/IndexedDB/`QingxinApi`, encrypt diary notes, and stub AI behind `AiGateway` with a deterministic mock. Echo owns real insight later.

The live tree already has `api/` (Axum, SQLx, AES-GCM, `UnconfiguredAiGateway`) and `web/` (SvelteKit 5, kit, themes, mock client). `/modules/mood` is a placeholder. `routes.rs` is a single file; M1 domain logic belongs in `mood.rs` so the foundation file does not grow another 400 lines of SQL.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- A complete M1 MVP a person can use offline-first in zh-CN on a 390px phone and a 1280px desktop.
- Tests first for validation, encryption, trends, insight fallback, mock API, and breathing/hotline helpers.
- Screenshots at 390/1280 × light/dark of the M1 screens.

**Non-Goals:**

- Real DashScope/Zhipu/Kimi/Ollama calls, semantic cache, or gateway SSE (Echo / PR #6).
- Medical diagnosis, therapy, crisis intervention, or a live counselor chat.
- A new chart library, a new component kit, or a mood-only theme engine.
- Merging the PR (PO merges).

**Anti-goals:**

- Changing `AiGateway::complete` into a streaming trait that races Echo.
- Storing diary notes in plaintext "until later".
- Shipping a public "safe" moderation HTTP route.

## Decisions

### D1 — Persistence

**Chosen:** Two tables, `mood_logs` and `meditation_sessions`, TEXT UUID PKs, TEXT RFC3339 timestamps, `ON DELETE CASCADE` from `users`. Notes are `note_encrypted BLOB`; emoji, integer score, and `tags_json` stay plaintext.

**Assumptions challenged against the tree:** T1 explicitly left module domain tables out. Privacy export today lists profile/consents/devices/jobs/push — M1 must extend that or diary data is invisible to 导出. `routes.rs` already decrypts phone on export; diary notes follow the same owner-only decrypt path.

**Rejected:**

1. **JSON blob column on `users`** — rejected: cannot index by day/tag, export becomes opaque, and SQLite JSON1 is a portability trap the T1 design already avoided.
2. **IndexedDB-only (no API tables)** — rejected: issue #9 says extend `api/openapi.yaml` and use T1 encryption. Client-only would skip the contract and leave export empty.
3. **One `ugc_entries` table for every module** — rejected: M2/M3/M5 would fight over a generic schema; the Notion card names these two tables.

### D2 — AI insight seam

**Chosen:** Mood insight and monthly summary call `state.ai.complete`. On `AiError::Unconfigured` (today's default), a `deterministic_insight` / `deterministic_monthly_summary` function returns canned zh-CN copy from emoji + sorted tags + counts. Injected gateways win. `/v1/ai/complete` is untouched.

**Rejected:**

1. **Replace `AppState.ai` with a live provider** — rejected: user brief and T1 forbid real model calls; Echo's PR would conflict.
2. **Always 501 until Echo merges** — rejected: the M1 UI would be a dead insight card. The card asks for empathetic insight in this MVP, stubbed.
3. **Add `AiGateway::stream` now** — rejected: Echo owns streaming on the gateway. Adding a second method here forks the seam.

### D3 — "Streamed" insight

**Chosen:** `POST /v1/mood/insights` returns the full text + `disclaimer` + `source` (`gateway` | `mock`). The web client typewriter-chunks that string (respecting `prefers-reduced-motion`: show all at once). Same text is cached in IndexedDB.

**Rejected:**

1. **HTTP SSE from the mood route that re-chunks `complete()`** — extra Axum/futures surface for a mock; Echo will stream for real later. Not worth a new crate this change.
2. **Token-by-token from a fake tokenizer in Rust** — rejected: tests would assert timing, which is flaky in CI.
3. **No animation, dump the paragraph** — rejected: Notion says streamed; a typewriter on the mock is the honest UI without lying about a model.

### D4 — Charts

**Chosen:** First-party SVG polyline / bars using `--qx-chart-*` tokens already in `layout.css`. Unit-test the aggregator (`points`, `tag`, `period`) as a pure function.

**Rejected:**

1. **ECharts / Chart.js** — T2 design rejected shipping a chart runtime; kit tokens exist so a later library can adopt them. A 7- or 30-point sparkline does not need 200 KB.
2. **CSS-only bars with no numeric axis** — rejected: weekly/monthly trend is an acceptance criterion; users need to see the line, not just a legend.
3. **Server-rendered PNG** — rejected: extra dependency, useless offline.

### D5 — Meditation audio and stories

**Chosen:** Web Audio API synthesizes rain / waves / fan / fire / white noise in-process (no binary assets). Bedtime stories are a small zh-CN catalog in `web/src/lib/mood/catalog.ts` and mirrored by `GET /v1/meditation/catalog` so the mock and HTTP stay aligned. Sessions persist `kind`, `duration_sec`, and a small `payload_json`.

**Rejected:**

1. **Bundled MP3/OGG in `static/`** — rejected: large, copyright-risky, and the PWA cache would balloon.
2. **Third-party streaming (YouTube / 网易云)** — rejected: network, licensing, and a medical-adjacent "sleep aid" claim we do not want.
3. **Speech synthesis as the only story player** — rejected: `speechSynthesis` voices are OS-dependent and often English-first; show large readable text, optional utterance later.

### D6 — Routing and chrome

**Chosen:** Keep `/modules/mood` as the only new URL. Three kit `Tabs` (日记 / 趋势 / 冥想) plus overlays (fullscreen breathe/timer, story reader, hotline `Modal`). Matches spec 1.4 (tabs/drawers/modals over page jumps) and the existing `Tabs` grid, which is hardcoded to three columns.

**Rejected:**

1. **Nested routes `/modules/mood/breathe` etc.** — rejected: static prerender + `[slug]` entries get messier; more jumps on a phone.
2. **A second bottom-tab item "心情"** — rejected: T2 chrome is 首页 / 模块 / 组件 / 我的; do not steal a tab from the shell.
3. **Hamburger-only module nav** — rejected: core actions must stay in the lower half on 390px.

### D7 — Encryption scope

**Chosen:** Encrypt only `note`. Emoji, score (1–5, derived from a closed emoji catalog), and tags stay plaintext. Empty notes store `NULL`, not an empty ciphertext.

**Rejected:**

1. **Encrypt the whole row** — rejected: trends and tag filters would require decrypting every log in the handler (and leak the key into a hotter path).
2. **Client-side-only encryption** — rejected: issue says use T1 AES-GCM; the server already has `FieldCrypto`.
3. **Plaintext notes plus a "encrypt in T13" comment** — rejected: T1 already refused this for phone.

### D8 — Crisis hotline

**Chosen:** Primary number `12356` (全国心理援助热线). Confirmation `Modal` states that 轻心 is not crisis intervention. Confirm sets `window.location.href = 'tel:12356'`. Cancel closes the modal. Copy is zh-CN.

**Rejected:**

1. **Immediate `tel:` without confirm** — rejected: Notion says one-tap *with confirmation*; mis-taps on a 44px button would call.
2. **In-app chat / AI crisis counselor** — rejected: medical-adjacent, needs Echo, and we explicitly disclaim treatment.
3. **A long list of local numbers** — rejected: geo + maintenance; one national number is enough for MVP.

## Design review (self-grill)

**Proposer:** Ship a thin but complete module: two tables, encrypted notes, stubbed insight, kit-built screens, no new platform pieces.

**Reviewer pushback:**

1. *A deterministic "insight" will be mistaken for a model.* — Label the card 示意洞察, always show 不构成医疗建议, and set `source: mock` unless a gateway actually answered.
2. *Typewriter is not streaming.* — Correct. Real SSE waits for Echo. The AC wants the *feeling* of a streamed reply; the HTTP contract stays a single JSON document so tests are deterministic.
3. *Web Audio will fail on iOS until a gesture.* — Start the `AudioContext` only from a button click (开始混合 / 播放). Document that.
4. *`routes.rs` will become unreadable.* — Domain stays in `mood.rs`; routes only extract/auth and call it.
5. *Exporting decrypted notes is a leak.* — Same as phone: owner-authenticated export only. Public list endpoints also decrypt only for `AuthUser`.
6. *Closed emoji/tag catalogs feel small.* — They make scores and filters deterministic. Custom tags can wait; the cloud is an MVP tag set, not an open folksonomy.
7. *Fullscreen timer vs. the 44px tab bar.* — Overlay is `fixed inset-0 z-50` and hides shell chrome; a 关闭 control stays ≥44px at the bottom.
8. *Mock API and Axum will drift.* — Shared field names live in OpenAPI; frontend types are written to match. Unit tests on both sides assert the same limits (`note` length 99, known emojis).

**Revisions after grilling:**

- Do not add `stream` to `AiGateway`.
- Insight JSON includes `source` and a fixed disclaimer string.
- Encrypt note only; tags/emoji remain filterable.
- Three tabs on one route; overlays for breathe/timer/hotline.
- Web Audio resumes only after a user gesture.
- Privacy export and delete cascade include the two new tables.
- `Tabs` stays at three items so we do not have to restyle the kit primitive.

## Risks / Trade-offs

- **[Risk] Echo's `complete` shape changes** — Mitigation: mood builds a small `CompletionRequest` (`role=user`, one message). If Echo adds fields they stay optional.
- **[Risk] Typewriter feels like a real therapist** — Mitigation: 示意 + disclaimer on every insight and on the module footer.
- **[Risk] IndexedDB outbox replays a check-in twice** — Mitigation: client generates `id` (UUID); server inserts with that id (`ON CONFLICT` / 409).
- **[Risk] `tel:` ignored on desktop** — Mitigation: confirmation copy includes the number as selectable text so a 1280px user can still dial.
- **[Risk] Clippy on a growing `routes.rs`** — Mitigation: keep handlers thin.

## Migration Plan

1. Land OpenSpec artifacts, then tests, then implementation on `cursor/m1-mood-meditation-4b9f`.
2. Echo replaces `UnconfiguredAiGateway`; mood insight starts returning `source: gateway` with no UI rewrite.
3. A later HTTP `QingxinApi` implements the same methods from OpenAPI.
4. Rollback: revert the branch; drop `0002_mood.sql` on empty local DBs.

## Open Questions

None that block M1. Real streamed gateway tokens wait for Echo. Custom tags and speech synthesis wait for polish (T13).
