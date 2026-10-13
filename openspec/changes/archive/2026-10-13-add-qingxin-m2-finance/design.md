# Design

## Context

See proposal.md — Why. T1 lives at `api/` (`qingxin-api`, Axum 0.8, SQLx SQLite, `AuthUser`, `AppError`, `FieldCrypto`, `scheduled_jobs` + `PushSender`, `AiGateway`). T2 lives at `web/` (SvelteKit 5, Quill kit, CSS tokens, IndexedDB `enqueueSync`/`drainSync`). The draft assumed `qingxin/server` and `qingxin/web` and left open questions; PO decisions override it.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per major decision, checked against the live tree.

## Goals / Non-Goals

**Goals:**

- Three-tap CNY entry, monthly overview, budgets, subscriptions with reminders, manual savings challenges.
- Owner isolation (404/401), encrypted notes, privacy export/delete hooks.
- Finance UI that uses Quill primitives and inherits global text-size / contrast tokens.

**Non-Goals:**

- Voice bookkeeping, bank/Alipay import, multi-currency, shared ledgers, investment advice, receipt OCR.
- Implementing Echo's `AiGateway` or an M2 insight product surface.
- Elder-mode settings UI (owned elsewhere).
- Rewriting T1 `routes.rs` into a modules tree or adding finance methods to T2 `QingxinApi`.

## Decisions

### D1 — Paths and crate layout

**Chosen:** `api/src/finance/` mounted at `/v1/finance/*` via `Router::merge`. Web at `web/src/routes/finance/` plus `web/src/routes/modules/finance/+page.ts` redirect. Shared hunks: `lib.rs` module, router merge, export JSON key, one scheduler tick.

**Assumptions challenged:** PLAN.md `qingxin/server` is stale (T1 already chose `api/`). Draft `/api/v1/finance` does not match T1 `/v1/...`.

**Rejected:**

1. **`qingxin/server` + `/api/v1/finance` as in the draft** — orphans the merged crate and forks the published OpenAPI prefix.
2. **Append every handler to `api/src/routes.rs`** — that file is already ~970 lines; M3 would collide on the same blob.
3. **Nest finance under `/v1/me/finance`** — T1 resources are top-level (`/v1/jobs`, `/v1/devices`); extra nesting helps no client.

### D2 — Amounts and currency

**Chosen:** `amount_fen: i64` strictly `> 0` plus `type` `income|expense`. Responses include `currency: "CNY"`. Reject any other currency field.

**Rejected:**

1. **REAL/float `amount` as in design.txt** — rounding; SQLite has no DECIMAL.
2. **Signed fen, no type column** — categories are kind-specific; a missed minus sign flips income/expense.
3. **Multi-currency + FX table** — PO: CNY only.
4. **Yuan strings in the API** — client locale parsing; fen keeps sums exact.

### D3 — Notes encryption

**Chosen:** `note_encrypted BLOB` via T1 `FieldCrypto` (nonce || AES-256-GCM). Empty notes are SQL NULL. Amounts stay plaintext so `SUM`/`GROUP BY` work. Export decrypts for the owner.

**Rejected:**

1. **Plaintext notes (draft v1)** — PO requires AES-GCM; notes can hold merchant names.
2. **Encrypt amounts too** — breaks server summary; PO says fen stay plaintext.
3. **Client-side E2E of the whole ledger** — breaks multi-device summary and T1 export.
4. **SQLCipher / pgcrypto** — T1 already rejected these for phones; reuse `FieldCrypto`.

### D4 — Categories

**Chosen:** `fin_categories` with `user_id NULL` system rows seeded in the migration (餐饮/交通/购物/居住/娱乐/医疗/学习/其他 expense; 工资/兼职/理财收益/其他收入). Users may add customs. System rows are read-only. Transaction `category_id` must match `type`.

**Rejected:**

1. **Free-text category on the transaction** — rename breaks reports and budgets.
2. **JSON enum in the API only, no table** — no user customs; budgets need a stable FK.
3. **Double-entry accounts** — overkill for 极简记账.

### D5 — API shape

**Chosen:** REST JSON under `/v1/finance` with T1 `AppError` envelope:

- `GET/POST /categories`, `PATCH/DELETE /categories/{id}`
- `GET /transactions` keyset (`occurred_on`, `id`), `POST` (idempotent `client_id`), `GET/PATCH/DELETE /transactions/{id}`
- `GET /summary?month=YYYY-MM`, `GET /report?from=&to=&group=category|month`
- `GET/PUT /budgets` bulk upsert
- `GET/POST/PATCH/DELETE /subscriptions[/{id}]`, `GET /subscriptions/upcoming`
- `GET/POST /challenges`, `POST /challenges/{id}/checkins`, `DELETE /challenges/{id}`
- `GET /export.csv` plus privacy JSON hook

Axum 0.8 path params use `{id}`.

**Rejected:**

1. **GraphQL** — T1 is REST; one consumer.
2. **Client-only aggregates** — YoY needs history phones may not cache.
3. **Shared `/v1/records` across M2/M6/M7/M8** — weak typing; M3 is already in flight.
4. **RPC `/finance/quick_add`** — `POST /transactions` is one call.

### D6 — Offline

**Chosen:** Reuse T2 `putRecord` / `enqueueSync` / `drainSync`. Quick entry writes IndexedDB + outbox keyed by `client_id`, then `POST`. Finance `+layout.svelte` drains on `online` / focus. Server idempotency makes retries safe. Last-write-wins on PATCH by `updated_at`.

**Rejected:**

1. **Online-only** — spec 1.4 离线优先; bookkeeping happens at the till.
2. **SQLite WASM / CRDT** — heavy versus T2's thin wrapper.
3. **Background Sync only** — missing on iOS Safari.
4. **Extend T2 `QingxinApi` + OfflineBanner switch** — shared-file conflict with M3; finance keeps its own client.

### D7 — Subscription reminders

**Chosen:** In-app upcoming list (首页 + 设置). On create/update, upsert a `scheduled_jobs` row `kind=web_push` with `run_at` = Shanghai 09:00 on `next_billing_date - remind_days_before`. T1 ticker + `PushSender` delivers. `finance::maintain_reminders` on each scheduler tick (and on upcoming/summary reads) rolls past `next_billing_date` by `cycle` and reschedules.

**Rejected:**

1. **In-app only (draft fallback)** — PO requires Web Push where supported, through T1's scheduler.
2. **Email reminders** — no mailer in T1.
3. **Per-subscription cron expressions** — cycles are four enums; date math is enough.
4. **Client Notification API only** — dies when the tab is closed; no server roll-forward.

### D8 — Savings challenges

**Chosen:** Manual check-ins. `UNIQUE (challenge_id, day)`. Repeat POST returns the existing row. No auto-fail from 餐饮 expenses.

**Rejected:**

1. **Auto-fail when a matching category expense is logged** — PO: manual.
2. **Streak computed only on the client** — refresh / second device would disagree.
3. **Link each check-in to a transaction id** — invents a product rule the spec does not have.

### D9 — Colours and charts

**Chosen:** `--qx-expense` red (`#DC2626` light, `#FB7185` dark) and `--qx-income` green (`#16A34A` / `#34D399`), scoped under `.qx-finance` so T2 `layout.css` stays untouched. Charts are SVG + CSS using T2 `--qx-chart-*` tokens. No ECharts dependency.

**Rejected:**

1. **Chinese stock convention (red up / green down)** — spec 1.3 and PO: red spending, green income.
2. **Add ECharts** — T2 D5 rejected a chart runtime; M2 would bloat the PWA.
3. **Put red/green on `:root` in `layout.css`** — shared file; M3 elder contrast work would merge-conflict.

### D10 — Elder mode and AI

**Chosen:** Pages use `rem` / `text-base` (16px+) and `var(--qx-font-size, 1rem)`, `var(--qx-text)`, `var(--qx-bg)`. No local toggle. v1 makes no `AiGateway` call; if a later insight is added it MUST go through `state.ai.complete`.

**Rejected:**

1. **Finance-local large-text switch** — PO: global setting owned elsewhere.
2. **Force light mode on finance** — that is M3's default, not M2.
3. **Call DashScope from the Svelte page** — bypasses the seam and needs provider keys.
4. **Ship `POST /v1/finance/insight` that always 501** — fake product surface; T1 already reserved `/v1/ai/complete`.

## Design review (self-grill)

**Proposer:** Thin module on T1 primitives: fen + encrypted notes, REST under `/v1/finance`, jobs for push, Svelte routes that inherit tokens.

**Reviewer pushback:**

1. *Encrypting notes but not amounts is inconsistent.* — Amounts must be `SUM`mable. PO split is explicit.
2. *A scheduler hook in `scheduler.rs` fights “finance files only”.* — One `maintain_reminders` call is the smallest way to roll dates when nobody opens the app. Reads also roll, so the hook is belt-and-suspenders.
3. *Memory finance client on the web diverges from OpenAPI.* — Types match the spec; HTTP client is real; mock is for Vitest and T2's still-mock session.
4. *System categories with `user_id NULL` plus ON DELETE CASCADE is awkward.* — System rows have no user; user customs cascade. Transactions FK to category; deleting a used custom returns 409.
5. *SQLite UNIQUE on nullable `category_id` allows two overall budgets.* — Unique index on `(user_id, COALESCE(category_id, ''))`.
6. *Red/green in dark mode fails WCAG.* — Dark expense is `#FB7185` on `#111827`, not `#DC2626`.
7. *Idempotent POST that ignores a second payload hides client bugs.* — Prefer safe retries over 409 on flaky radios; first payload wins.
8. *CSV plus JSON export is two formats.* — JSON is the T1 privacy contract; CSV is the draft/report convenience. Both decrypt notes.

**Revisions after grilling:**

- Paths are `/v1/finance` in `api/`, not `qingxin/server`.
- Notes encrypted; amounts plaintext fen; CNY only.
- Voice out; challenges manual; reminders use `scheduled_jobs`.
- Charts stay SVG; colour tokens stay in finance CSS.
- Privacy and field-encryption specs get additive deltas.

## Risks / Trade-offs

- **[Risk] M3 edits `routes.rs` export at the same time** → Mitigation: append a single `finance` key via `crate::finance::export_for_user`; do not reformat the handler.
- **[Risk] Shanghai fixed offset ignores DST (none) but travelers see “wrong” today** → Mitigation: `occurred_on` is a client date string; month filters compare strings.
- **[Risk] Outbox drains without a T1 token while T2 session is still mock** → Mitigation: local Memory store remains source of truth until `PUBLIC_QINGXIN_API` is set.
- **[Risk] Soft-deleted transactions still in export** → Mitigation: export only `deleted_at IS NULL`.
- **[Risk] Push without a browser subscription is a log-only send** → Mitigation: T1 `LogPushSender` / `RecordingPushSender`; in-app upcoming still works.

## Migration Plan

1. Land additive `0002_finance.sql` (no down migration in SQLx folder; drop tables only if the PR is reverted).
2. Ship OpenAPI + handlers + web routes on this branch.
3. Rollback: revert the PR; no production finance data yet.

## Open Questions

None that block implementation. PO closed voice, colours, CNY, encryption, push, and manual challenges.
