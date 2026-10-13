# Design

## Context

Issue #23, Notion card [M9 内容创作助手](https://app.notion.com/p/3f8469841e1f81c9aec2d12b714eddb1), and the user brief agree: build the module on merged T1 API + AI gateway + T2 shell + M1 / M10 / M7 patterns, reuse kit/tokens/IndexedDB/`QingxinApi`, keep the editor dark by default, mimic platform previews, stub AI behind `AiGateway`, and generate PPTX on the client.

The live tree already has `api/` (Axum, SQLx, `AiGateway::complete`) and `web/` (SvelteKit 5, kit, themes, mock client). `/modules/create` is the `[slug]` placeholder. `/v1/ai` is the T1 completion seam — M9 HTTP must not reuse that path. M1/M10 kept domain logic in `mood.rs` / `hustle.rs`; M7 used a folder. M4 (PR #20) is in flight and touches router, OpenAPI, migrations, and nav.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- A complete M9 MVP a person can use offline-first in zh-CN on a 390px phone and a 1280px desktop.
- Tests first for validation, isolation, titles/polish/outline stubs, diff, PPTX bytes, mock API, and privacy export.
- Screenshots at 390/1280 × light/dark of the M9 screens (home scenarios, editor, templates, works) plus updated home.

**Non-Goals:**

- Real DashScope/Zhipu/Kimi/Ollama calls from this module (Echo / gateway crate already exists; this change only *calls* the seam).
- Copywriting as a service, SEO ranking, publishing to 小红书/公众号/抖音, or an image model.
- A new editor library (CodeMirror / Monaco), a new chart library, or a create-only theme engine.
- Server-side PPTX or object storage for `.pptx` blobs.
- Merging the PR (PO merges).
- Implementing M5 AI效率工具箱 (issue #10) — that remains a separate module.

**Anti-goals:**

- Adding `AiGateway::stream` or a second AI trait.
- Putting create routes under `/v1/ai` (gateway collision).
- Editing `web/src/lib/nav.ts` (M4 in flight).
- Reformatting `routes.rs` or `openapi.yaml`.

## Decisions

### D1 — Persistence

**Chosen:** Two tables matching the issue contract — `creations` and `snippets` — TEXT UUID PKs, TEXT RFC3339 timestamps, `ON DELETE CASCADE` from `users`. Extra columns the UI needs: `creations.title`, `creations.versions_json` (JSON array of `{ at, kind, content }`), `creations.created_at` / `updated_at`; `snippets.kind` (`金句` | `案例` | `过渡`), `snippets.created_at` / `updated_at`. `prompt_params` is JSON TEXT (`platform`, `topic`, `keywords`, `tone`, `length`, `template_id`). `snippets.tags` is JSON TEXT. Client UUID `id` on create is idempotent (`ON CONFLICT DO NOTHING`).

**Assumptions challenged against the tree:** T1 export today lists profile/consents/devices/jobs/push/mood/hustle/finance/wellness — M9 must extend that or drafts are invisible to 导出. `/v1/ai` is already the gateway. M1 used a dedicated `mood.rs`; create follows hustle's single file, not more SQL in `routes.rs`.

**Rejected:**

1. **JSON blob column on `users`** — rejected: cannot list works by platform, export becomes opaque, and T1 already avoided JSON1-as-schema.
2. **IndexedDB-only (no API tables)** — rejected: issue #23 names the two tables and says extend the T1 contract. Client-only would skip OpenAPI and leave export empty.
3. **One `ugc_entries` table for every module** — rejected: M1 already chose dedicated tables; a generic bag would fight M5/M8 later.
4. **A third `creation_versions` table** — rejected: the issue names two tables; a JSON array on `creations` is enough for MVP history and stays in the named schema.

### D2 — HTTP prefix and resources

**Chosen:** `/v1/create/creations`, `/v1/create/snippets`, plus `/v1/create/templates`, `/v1/create/inspiration`, `/v1/create/titles`, `/v1/create/polish`, `/v1/create/generate`, `/v1/create/outline`, `/v1/create/snippets/{id}/use`. Matches the catalog slug `create`. Client UUID `id` on create is idempotent, same as mood logs and hustle.

**Rejected:**

1. **`/v1/ai/titles` (and friends)** — rejected: `/v1/ai` is the T1 completion seam. Shadowing it would break T1 and OpenAPI tags.
2. **`/v1/studio/*` or `/v1/content/*`** — rejected: the module slug is `create`; matching the slug keeps client paths obvious (same reason hustle rejected `/v1/career`).
3. **GraphQL / JSON-RPC one-shot** — rejected: T1 is Axum REST + OpenAPI.
4. **`/v1/wellness`-style folder of many resources with no generate endpoint** — rejected: generate/titles/polish are first-class AI actions, not only CRUD.

### D3 — AI seam

**Chosen:** Generate, titles (10), polish (`更专业` / `更幽默` / `更精简`), and PPT outline call `state.ai.complete` with model id `qingxin-create`. On `AiError::Unconfigured` or empty content, a deterministic zh-CN function returns canned copy from the inputs (platform, topic, sorted keywords, tone, length). Injected gateways win. JSON always includes `source` (`gateway` | `mock`) and a 不构成专业文案或营销建议 disclaimer. `/v1/ai/complete` is untouched. Unconfigured does **not** 501 for these endpoints (unlike wellness OCR): the UI would be four dead buttons.

**Rejected:**

1. **Call providers from `create.rs`** — rejected: user brief says stub behind `AiGateway`; Echo already owns providers.
2. **Always 501 until a human wires copy** — rejected: M7 OCR can 501 because paste-metrics still work; here generate *is* the product. Hustle already chose fallback.
3. **Add `AiGateway::stream` for the editor** — rejected: M1/M10 already refused this so Echo's seam stays one method. The client can typewriter the returned string.
4. **Client-only mock with no HTTP AI routes** — rejected: issue says all AI via the seam; tests must inject a gateway double.

### D4 — PPTX and Markdown export

**Chosen:** Outline is a structured JSON `{ title, slides: [{ heading, bullets[] }] }`. Markdown export is a pure function to an ATX document. PPTX export is a client-side generator: uncompressed ZIP (STORED) of OOXML (`[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml`, one `ppt/slides/slideN.xml` per slide). No new npm dependency. Unit tests assert zip signatures, slide count, and that headings appear in the XML. The server never stores the `.pptx`.

**Rejected:**

1. **pptxgenjs / PptxGenJS** — rejected: extra runtime, Node/browser quirks, and CI weight for a few title+bullet slides.
2. **Server-side `zip` crate + `quick-xml`** — rejected: user brief allows a client-side generator; shipping two exporters would drift.
3. **Print-to-PDF only (hustle A4 path)** — rejected: issue #23 names PPTX specifically. Print remains available as a browser affordance, not the contract.
4. **Base64 PPTX stored on `creations`** — rejected: ephemeral disk, export bloat, and the bytes are derived from the outline.

### D5 — Editor dark island and platform preview

**Chosen:** The prompt/editor pane is a dedicated `.create-editor` island with a hardcoded dark IDE palette (`#0F172A` background, `#E2E8F0` text, `#38BDF8` for `{{变量}}`) and `color-scheme: dark`, ignoring `html` light. Surrounding chrome follows the four T2 theme modes. The preview pane mimics platform rendering: 小红书 image card, 公众号 article column, 抖音 vertical caption, 周报 document. Diff is a pure `diffLines` of `generated_content` vs `final_content`.

**Rejected:**

1. **Force `html.dark` while the module is open** — rejected: would restyle the tab bar and leak into home if the user navigates away mid-session.
2. **Editor follows theme (light editor in 浅色)** — rejected: issue #23 says editor dark by default (IDE-like).
3. **Monaco / CodeMirror** — rejected: new runtime, font download, and overkill for a textarea with regex token spans.
4. **iframe screenshots of real 小红书** — rejected: network, ToS, and CI flake.

### D6 — Routing and chrome

**Chosen:** Keep `/modules/create` as the only new module URL (same as M10 `/modules/hustle`). Three kit `Tabs` (创作 / 模板 / 作品). Inner chips on 创作: 编辑 | 预览. Snippet drawer on 作品. Matches M1/M10 (tabs/drawers over page jumps) and the kit `Tabs` 3-column grid. Home (`/`) gains scenario cards (four platforms) and an inspiration feed, as the issue lists Home in scope. `web/src/lib/nav.ts` is **not** edited. `modules.ts` slug `create` stays; summary may be tightened. `[slug]/+page.ts` excludes `create`.

**Rejected:**

1. **Nested routes `/modules/create/editor` plus `/create` like M7 `/wellness`** — rejected: M7 renamed to avoid `/health`; `create` has no T1 collision. Extra jumps on a phone. User brief points at `/modules/hustle`.
2. **Five kit tabs** — rejected: `Tabs` is hardcoded to `grid-cols-3`; restyling the primitive for one module is out of scope.
3. **A second bottom-tab item "创作"** — rejected: T2 chrome is 首页 / 模块 / 组件 / 我的, and M4 is already touching nav.
4. **Leave home unchanged** — rejected: issue #23 names Home scenario cards + inspiration feed.

### D7 — Version history

**Chosen:** `versions_json` on `creations`. Generate persist and polish/save append `{ at, kind: generate|polish|edit, content }`. List works newest first. Opening a work restores `final_content` and shows the history list. First snapshot is the initial `generated_content`.

**Rejected:**

1. **New `creation_versions` table** — rejected: extra migration surface while M4/M6 fight over numbers; not in the issue schema.
2. **Git-style patches** — rejected: overkill; users need readable past copy, not hunks.
3. **One row per polish (no in-place update)** — rejected: works page would flood with near-duplicates; isolation tests get harder.

### D8 — Encryption and moderation

**Chosen:** Do not AES-GCM create rows. Drafts and snippets are owner-scoped via auth, same as hustle resumes, not diary-grade secrets. Export returns plaintext for the owner. `Moderator` is not invoked on generate (output is the user's own prompt in, stub out); snippet `content` is owner text, not public UGC.

**Rejected:**

1. **Encrypt `generated_content` / `final_content`** — rejected: issue does not ask for it; list/search/preview would decrypt on every list. M1 encrypted diary notes because the Notion card required it; M7 encrypted symptoms.
2. **Client-side-only encryption** — rejected: T1 already has `FieldCrypto`; mixing schemes is worse than neither.
3. **Run `Moderator` on every generate** — rejected: T1 moderation is a no-op stub not exposed as HTTP; blocking the editor on it adds nothing.

### D9 — Catalogs, flow, and copy

**Chosen:** Platforms `小红书` | `公众号` | `抖音` | `周报`. Tones `更专业` | `更幽默` | `更精简`. Lengths `短` | `中` | `长`. Templates and inspiration cards are closed catalogs in `web/src/lib/create/catalog.ts`, mirrored by `GET /v1/create/templates` and `GET /v1/create/inspiration`. Flow: pick scenario → topic/keywords → tone/length → generate → polish → copy. Title generator returns exactly 10 strings. Snippet kinds `金句` | `案例` | `过渡`. Using a snippet increments `usage_count`.

**Rejected:**

1. **Open folksonomy for platforms** — rejected: previews and prompt templates need a closed set so tests and CSS islands stay deterministic.
2. **Persist every title batch as a creation** — rejected: titles are a picker; the user saves after generate.
3. **Market scrape for 小红书 trending topics** — rejected: network, ToS, flaky CI.

### D10 — Shared-file strategy and migration number

**Chosen:** Migration `0007_create.sql` (latest on `main` is `0006_wellness.sql`). Shared hunks are append-only: `pub mod create` in `lib.rs`; `.merge(crate::create::routes())` in `routes.rs`; two export keys; OpenAPI tag + description line + paths immediately before `components:` + `ExportPayload.creations/snippets` + schemas at EOF; `[slug]` filter adds `create`; home card appended; `QingxinApi` methods appended. If another module claims `0007` on main before this PR lands, rename without changing SQL. Do not reformat `routes.rs` / `openapi.yaml`. Do not touch `nav.ts`.

**Rejected:**

1. **`0006_create.sql`** — rejected: `0006` is wellness on current main; M4/M6 in-flight PRs already reused 0006 on stale bases.
2. **Hard-code 0007 as immovable in tasks** — rejected: parallel M5/M8 may land first; tasks say "next free after fetch".
3. **Extend T2 `QingxinApi` only after a real HTTP client exists** (M7 style) — rejected: M1/M10 and the PWA mock are the live client; screens must call typed methods.

### D11 — Diff

**Chosen:** Line-oriented LCS `diffLines(previous, next)` returning `{ type: 'equal' | 'add' | 'remove', text }[]`. Rendered in the split view between generated and final. No npm diff library.

**Rejected:**

1. **word-diff / Myers in a vendored crate** — rejected: extra code for a polish-vs-draft comparison.
2. **`<ins>` browser `contenteditable` execCommand** — rejected: not testable as a pure function.
3. **No diff, just two textareas** — rejected: issue #23 names split view with diff.

## Design review (self-grill)

**Proposer:** Ship a thin but complete module: two tables, stubbed AI, kit-built screens, dark editor island, client PPTX, no new platform pieces, append-only shared files.

**Reviewer pushback:**

1. *A deterministic "generate" will be mistaken for a model.* — Label 示意文案 / 示意标题 / 示意大纲, always show 不构成专业文案或营销建议, and set `source: mock` unless a gateway actually answered.
2. *Uncompressed PPTX is not a "real" PowerPoint.* — Correct and sufficient. STORED ZIP + Office Open XML opens in PowerPoint/Keynote/Google Slides. Tests lock the content types and slide XML.
3. *Dark editor in light mode looks broken.* — Intentional island, same trick as hustle's light A4. Unit test asserts `.create-editor` hex colors; Playwright in light theme must still show a dark pane.
4. *`routes.rs` will become unreadable.* — Domain stays in `create.rs`; routes only merge the router and extend export.
5. *Three kit tabs hide five features.* — Inner chips and a snippet drawer keep the kit primitive intact. E2E screenshots target 编辑器, 模板, and 作品 so reviewers still see the named surfaces.
6. *Home clutter for users who never open create.* — Seed demo inspiration only after mock login (same as M1/M10). Empty state copy stays calm: 还没有作品.
7. *`versions_json` cannot be queried.* — Works list does not filter by version; history is per-row. A table can wait.
8. *Mock API and Axum will drift.* — Shared field names live in OpenAPI; frontend types match snake_case on the wire and camelCase in TS, same as M1/M10.
9. *M4 will conflict on OpenAPI line noise.* — Append paths before `components:`; append schemas at EOF; one tag line; do not wrap existing YAML.
10. *M5 AI toolbox will duplicate titles/polish.* — M9 is platform-templated social/PPT copy under `/modules/create`. M5 stays the generic toolbox. Do not steal `/modules/ai`.
11. *Editor highlighting with regex will mangle CJK.* — Tokens are `{{...}}` ASCII braces; CJK inside the braces is still one span.
12. *Idempotent UUID create races two clients.* — Same as mood/hustle: `ON CONFLICT DO NOTHING` then SELECT existing.

**Revisions after grilling:**

- Do not add `stream` to `AiGateway`.
- AI JSON includes `source` and a fixed disclaimer string.
- Do not encrypt create rows.
- Three tabs on one route; inner chips for 编辑/预览.
- Editor is a dark island; platform previews are their own mock surfaces.
- PPTX is client-side STORED OOXML with tests.
- Privacy export and delete cascade include the two new tables.
- HTTP lives under `/v1/create`, never `/v1/ai`.
- Migration `0007_create.sql`; renumber if main moved.
- No `nav.ts` edits.

## Risks / Trade-offs

- **[Risk] Echo's `complete` shape changes** — Mitigation: create builds a small `CompletionRequest` (`role=user`, one message). Extra fields stay optional.
- **[Risk] Gateway returns prose instead of 10 titles** — Mitigation: mock path always returns 10; gateway path splits lines, pads/truncates to 10 using the deterministic list as filler.
- **[Risk] IndexedDB outbox replays a create twice** — Mitigation: client generates `id` (UUID); server inserts with that id (`ON CONFLICT` / return existing).
- **[Risk] Dark editor regression in light theme** — Mitigation: unit test asserts `.create-editor` dark hex colors; Playwright screenshots in light theme must still show a dark pane.
- **[Risk] OpenAPI / routes.rs conflict with M4** — Mitigation: append-only hunks; rebase onto latest main before opening the PR.
- **[Risk] PPTX rejected by strict Office** — Mitigation: include `[Content_Types].xml`, presentation rels, slide rels, and `sldIdLst`; tests read those parts.
- **[Risk] Clippy on a growing `routes.rs`** — Mitigation: keep handlers in `create.rs`.

## Migration Plan

1. Land OpenSpec artifacts, then tests, then implementation on `cursor/m9-content-creation-ca02`.
2. Echo's live gateway already sits behind `QingxinAiGateway::from_env()`; create AI starts returning `source: gateway` when complete succeeds, with no UI rewrite.
3. A later HTTP `QingxinApi` implements the same methods from OpenAPI.
4. Rollback: revert the branch; drop `0007_create.sql` on empty local DBs.

## Open Questions

None that block M9. Image generation for 小红书 covers, streamed editor tokens, and a real HTTP client wait for later polish.
