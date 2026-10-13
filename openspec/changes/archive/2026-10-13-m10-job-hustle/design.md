# Design

## Context

Issue #13, Notion card [M10 求职与副业工具](https://app.notion.com/p/3f8469841e1f81d2b2fbf728417c5c40), and the user brief agree: build the module on merged T1 API + AI gateway + T2 shell + M1 patterns, reuse kit/tokens/IndexedDB/`QingxinApi`, keep the resume A4 preview light, darken kanban shadows and highlight status tags, and stub AI behind `AiGateway`.

The live tree already has `api/` (Axum, SQLx, `AiGateway::complete`) and `web/` (SvelteKit 5, kit, themes, mock client). `/modules/hustle` is the `[slug]` placeholder. `/v1/jobs` is the T1 scheduler — M10 HTTP must not reuse that path. M1 kept domain logic in `mood.rs` and three kit `Tabs` on one route.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- A complete M10 MVP a person can use offline-first in zh-CN on a 390px phone and a 1280px desktop.
- Tests first for validation, kanban moves, funnel, quote math, A4 light isolation, AI fallback, mock API, and privacy export.
- Screenshots at 390/1280 × light/dark of the M10 screens (resume, kanban, side-hustle) plus updated home.

**Non-Goals:**

- Real DashScope/Zhipu/Kimi/Ollama calls from this module (Echo / gateway crate already exists; this change only *calls* the seam).
- Career coaching, legal advice, or a live human interviewer.
- A new chart library, a new component kit, or a hustle-only theme engine.
- Object storage for real PDF blobs (print-to-PDF is the MVP; `pdf_url` may be null).
- Merging the PR (PO merges).

**Anti-goals:**

- Adding `AiGateway::stream` or a second AI trait.
- Putting hustle routes under `/v1/jobs` (scheduler collision).
- Letting the A4 preview inherit `.dark` tokens.

## Decisions

### D1 — Persistence

**Chosen:** Three tables matching the issue contract — `applications`, `resumes`, `side_hustles` — TEXT UUID PKs, TEXT RFC3339 timestamps, `ON DELETE CASCADE` from `users`. Extra columns that the UI needs: `applications.updated_at`, `resumes.title` / `created_at` / `updated_at`, `side_hustles.kind` (`线上` | `线下` | `技能型`) and `hours_per_week`. `resumes.content_json` and `side_hustles.skills_required` are JSON TEXT. `pdf_url` is nullable TEXT.

**Assumptions challenged against the tree:** T1 export today lists profile/consents/devices/jobs/push/mood — M10 must extend that or resume/job data is invisible to 导出. `/v1/jobs` is already `scheduled_jobs`. M1 used a dedicated `mood.rs`; hustle follows that, not more SQL in `routes.rs`.

**Rejected:**

1. **JSON blob column on `users`** — rejected: cannot list kanban by status, export becomes opaque, and T1 already avoided JSON1-as-schema.
2. **IndexedDB-only (no API tables)** — rejected: issue #13 names the three tables and says extend the T1 contract. Client-only would skip OpenAPI and leave export empty.
3. **One `ugc_entries` table for every module** — rejected: M1 already chose dedicated tables; a generic bag would fight M2/M5 later.

### D2 — HTTP prefix and resources

**Chosen:** `/v1/hustle/applications`, `/v1/hustle/resumes`, `/v1/hustle/side-hustles`, plus `/v1/hustle/funnel`, `/v1/hustle/questions`, `/v1/hustle/resumes/{id}/optimize`, `/v1/hustle/interviews/mock`, `/v1/hustle/side-hustles/suggest`. Client UUID `id` on create is idempotent (`ON CONFLICT DO NOTHING`), same as mood logs.

**Rejected:**

1. **`/v1/jobs/applications`** — rejected: `/v1/jobs` is the scheduler. Shadowing it would break T1 and OpenAPI tags.
2. **`/v1/career/*`** — rejected: the module slug is `hustle`; matching the slug keeps client paths obvious.
3. **GraphQL / JSON-RPC one-shot** — rejected: T1 is Axum REST + OpenAPI.

### D3 — AI seam

**Chosen:** Resume optimize, mock interviewer, and side-hustle suggestions call `state.ai.complete`. On `AiError::Unconfigured` or empty content, a deterministic zh-CN function returns canned copy from the inputs (sorted skills, question id, resume name/title). Injected gateways win. JSON always includes `source` (`gateway` | `mock`) and a 不构成求职/面试/副业咨询 disclaimer. `/v1/ai/complete` is untouched.

**Rejected:**

1. **Call providers from `hustle.rs`** — rejected: user brief says stub behind `AiGateway`; Echo already owns providers.
2. **Always 501 until a human wires copy** — rejected: the UI would be three dead buttons. The card asks for the features, stubbed.
3. **Add `AiGateway::stream` for the mock interviewer** — rejected: M1 already refused this so Echo's seam stays one method. The client can typewriter the returned string.

### D4 — Resume preview and PDF

**Chosen:** Live A4 preview is a dedicated `.resume-a4` island with hardcoded light palette (`#FFFFFF` / `#1F2937`) and `color-scheme: light`, ignoring `html.dark`. Scale with CSS `transform` to fit 390px. PDF export is `window.print()` of that island (plus a unit-tested HTML serializer). `pdf_url` stays null until object storage exists.

**Rejected:**

1. **html2canvas + jsPDF** — rejected: extra weight, flaky fonts, and CI screenshot noise. Print is the native A4 path.
2. **Server-side PDF crate (printpdf / typst)** — rejected: no binary assets pipeline, and the preview would drift from the PDF.
3. **Preview follows theme (dark A4)** — rejected: issue #13 and the user brief say the preview is always light.

### D5 — Kanban interaction and dark treatment

**Chosen:** Three columns 投递 / 面试 / Offer. Desktop uses HTML5 drag-and-drop; every card also has a ≥44px status control so 390px and keyboard users can move without DnD. Funnel is a first-party SVG using `--qx-chart-*`. Dark kanban cards use a deeper shadow utility (`hustle-kanban-card`); status tags use new Tag tones with a visible ring highlight.

**Rejected:**

1. **dnd-kit / SortableJS** — rejected: new runtime for three columns; HTML5 + a select is enough and testable.
2. **Four+ columns (including 拒绝 / 归档)** — rejected: the issue names three statuses. Extra columns are YAGNI.
3. **CSS-only funnel with no numbers** — rejected: a funnel chart is an acceptance criterion; users need counts per stage.

### D6 — Routing and chrome

**Chosen:** Keep `/modules/hustle` as the only new module URL. Three kit `Tabs` (求职 / 副业 / 今日) plus inner chips (简历 | 看板 | 题库, and 灵感 | 报价). Matches M1 (tabs/drawers over page jumps) and the kit `Tabs` 3-column grid. Home (`/`) gains a job-status card and today's todos, as the issue lists Home in scope.

**Rejected:**

1. **Nested routes `/modules/hustle/resume` etc.** — rejected: static prerender + `[slug]` entries get messier; more jumps on a phone.
2. **Five kit tabs** — rejected: `Tabs` is hardcoded to `grid-cols-3`; restyling the primitive for one module is out of scope.
3. **A second bottom-tab item "求职"** — rejected: T2 chrome is 首页 / 模块 / 组件 / 我的.

### D7 — Quote calculator and catalogs

**Chosen:** Quote is a pure function `quoteSheet(hours, difficulty, hourlyRate=200)` with `multiplier = 0.7 + difficulty * 0.3` (difficulty 1..=5) and integer yuan total. Interview questions and seed side-hustle cards are closed catalogs in `web/src/lib/hustle/catalog.ts`, mirrored by `GET /v1/hustle/questions` and demo seed data so mock and HTTP stay aligned.

**Rejected:**

1. **Persist every quote as a row** — rejected: no table in the issue; a sheet the user can screenshot/print is enough.
2. **Open folksonomy for roles/filters** — rejected: filters 线上/线下/技能型 and roles 前端/后端/产品/运营 stay closed so tests are deterministic.
3. **Market-rate HTTP scrape for income** — rejected: network, flaky CI, and a "this is your salary" claim we do not want. Estimates are labeled 示意.

### D8 — Encryption scope

**Chosen:** Do not AES-GCM hustle rows. Resume JSON and application notes are owner-scoped via auth, same as elder content, not diary-grade secrets. Export returns plaintext for the owner.

**Rejected:**

1. **Encrypt `content_json` and `notes`** — rejected: issue does not ask for it; kanban/search/preview would decrypt on every list. M1 encrypted diary notes because the Notion card required it.
2. **Client-side-only encryption** — rejected: T1 already has `FieldCrypto`; mixing schemes is worse than neither.
3. **Put government-ID fields on the resume form** — rejected: T1 reserved AES for phone/ID; this module must not collect them.

## Design review (self-grill)

**Proposer:** Ship a thin but complete module: three tables, stubbed AI, kit-built screens, always-light A4, darker kanban, no new platform pieces.

**Reviewer pushback:**

1. *A deterministic "optimize" will be mistaken for a model.* — Label 示意改写 / 示意追问 / 示意灵感, always show 不构成求职或面试建议, and set `source: mock` unless a gateway actually answered.
2. *Print is not PDF export.* — Correct. The AC wants a printable A4 sheet. Native print-to-PDF is the honest MVP; `pdf_url` remains nullable so a later blob store can fill it without a schema break.
3. *HTML5 DnD fails on iOS.* — Status `<select>` / buttons are the real mover; DnD is progressive enhancement and is not the only path in tests.
4. *`routes.rs` will become unreadable.* — Domain stays in `hustle.rs`; routes only merge the router and extend export.
5. *Three kit tabs hide five features.* — Inner chips keep the kit primitive intact. E2E screenshots target 简历, 看板, and 副业 so reviewers still see the named surfaces.
6. *Home clutter for users who never open hustle.* — Seed demo data only after mock login (same as M1 mood seeds). Empty state copy stays calm: 还没有投递.
7. *Quote multiplier is arbitrary.* — Document it as 示意系数, not market data. Tests lock the formula so it cannot silently change.
8. *Mock API and Axum will drift.* — Shared field names live in OpenAPI; frontend types match snake_case on the wire and camelCase in TS, same as M1.

**Revisions after grilling:**

- Do not add `stream` to `AiGateway`.
- AI JSON includes `source` and a fixed disclaimer string.
- Do not encrypt hustle rows.
- Three tabs on one route; inner chips for resume/kanban/questions and ideas/quote.
- A4 preview is a light island; PDF is print.
- Kanban always has a non-drag status control.
- Privacy export and delete cascade include the three new tables.
- HTTP lives under `/v1/hustle`, never `/v1/jobs`.

## Risks / Trade-offs

- **[Risk] Echo's `complete` shape changes** — Mitigation: hustle builds a small `CompletionRequest` (`role=user`, one message). Extra fields stay optional.
- **[Risk] Print dialog blocked in some WebViews** — Mitigation: the A4 preview is already visible; user can screenshot. Button copy is 导出 PDF（打印）.
- **[Risk] IndexedDB outbox replays a create twice** — Mitigation: client generates `id` (UUID); server inserts with that id (`ON CONFLICT` / return existing).
- **[Risk] Dark A4 regression** — Mitigation: unit test asserts `.resume-a4` light hex colors; Playwright screenshots in dark theme must still show a white page.
- **[Risk] Clippy on a growing `routes.rs`** — Mitigation: keep handlers in `hustle.rs`.

## Migration Plan

1. Land OpenSpec artifacts, then tests, then implementation on `cursor/m10-job-hustle-b7b7`.
2. Echo's live gateway already sits behind `QingxinAiGateway::from_env()`; hustle AI starts returning `source: gateway` when complete succeeds, with no UI rewrite.
3. A later HTTP `QingxinApi` implements the same methods from OpenAPI.
4. Rollback: revert the branch; drop `0004_hustle.sql` on empty local DBs.

## Open Questions

None that block M10. Real PDF object storage and streamed mock-interviewer tokens wait for later polish.
