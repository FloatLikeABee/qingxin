# Design

## Context

See proposal.md — Why. T1 lives at `api/` (`qingxin-api`, Axum 0.8, SQLx SQLite, `AuthUser`, `AppError`, `FieldCrypto`, `scheduled_jobs` + `PushSender`, `AiGateway`). T2 lives at `web/` (SvelteKit 5, Quill kit, CSS tokens). M2 finance and M3 elder are merged on main (`b5268c1`). Capability `health` and route `GET /health` already exist. The draft assumed `qingxin/server` and `qingxin/web` and left OPEN-QUESTIONS.md; PO decisions override it.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per major decision, checked against the live tree.

## Goals / Non-Goals

**Goals:**

- Water progress ring (default 2000 ml, +1 cup), sleep check-ins, consented period tracking with average prediction, metrics-only report archive, 21-day plans.
- Water reminders through T1 scheduler + Web Push; interval windows expanded into fixed HH:MM times.
- Owner isolation (404/401), caregivers never see wellness data, encrypted symptoms / sleep notes / report values, privacy export/delete hooks.
- Wellness UI that uses Quill primitives and inherits global text-size / contrast tokens so `html.elder` applies with no per-page elder code.
- Fixed 非医疗建议 notice everywhere; predictions labelled 仅供参考.

**Non-Goals:**

- Medical diagnosis, contraception guidance, clinical-grade cycle algorithms, wearable sync, step counters, file/PDF report storage.
- Implementing Echo's production OCR model; v1 is an `AiGateway` stub.
- Caregiver or elder-scoped wellness APIs.
- Rewriting T1 `routes.rs` into a modules tree or adding wellness methods to T2 `QingxinApi`.
- Restyling Quill kit primitives or adding a module-local elder toggle.

## Decisions

### D1 — Module and route name

**Chosen:** `wellness`. Code at `api/src/wellness/`, HTTP `/v1/wellness/*`, web `/wellness`, OpenSpec capability `qingxin-wellness`. Catalog slug `health` on the T2 modules grid stays; `/modules/health` redirects to `/wellness`.

**Assumptions challenged:** Design.txt 模块七 is titled 健康. `openspec/specs/health` already owns `GET /health`.

**Rejected:**

1. **`health` module/routes** — collides with T1 capability `health` and `/health`. OpenAPI tag Health already means liveness.
2. **`habits`** — too generic; M8 is 学习打卡.
3. **`qingxin-health` capability with `wellness` routes** — split names confuse archive and OpenAPI.

**Grill:** *Will users look for /health in the PWA?* The modules grid still says 健康 and lands on `/wellness`. *Draft used 0007_wellness.sql.* Latest on main is `0005_finance.sql`; apply uses the next free number (0006 unless M6 lands first).

### D2 — Period tracking consent (PIPL)

**Chosen:** Explicit `cycle_consent` boolean on `well_goals`, default `0`. `PUT /v1/wellness/consent`. Writes and prediction without consent return 403 `forbidden`. Turning consent off deletes all `well_cycles` rows. GET list without consent returns `{ items: [], cycle_consent: false }` so the UI can show the toggle. No cycle data is stored without consent.

**Rejected:**

1. **Reuse T1 PrivacyGate / policy_version only** — that gate is product ToS, not special-category health consent. PIPL needs a separate, off-by-default toggle.
2. **Ship period tracking with no extra consent** — PO rejected; menstrual data is sensitive personal information.
3. **Omit period tracking from v1** — in issue #18 scope; consent is the control, not deletion of the feature.
4. **On-by-default with an opt-out** — fails “minimum necessary” and the PO default.

**Grill:** *403 vs 404 for a POST without consent?* 403 because the collection exists and the missing permission is the user's own flag, not another user's id. Cross-user cycle ids remain 404. *Revoke but keep rows encrypted?* Residual special-category data is still processing; delete on revoke.

### D3 — Report storage and OCR

**Chosen:** Store only `{ name, value, unit }` metrics JSON (encrypted) plus title, report_date, source (`manual`|`ai_stub`), and `confirmed`. No file bytes, no `file_url`. `POST /v1/wellness/reports/ocr` sends `{ text }` through `AiGateway`; results land unconfirmed until the user confirms. Unconfigured gateway → 501 `ai_unconfigured`.

**Rejected:**

1. **Store PDFs in the SQLite row or local disk** — filesystem is ephemeral on hosts; no object store in T1; out of v1.
2. **Netlify Blobs / S3 now** — new infra, keys, and a second privacy surface.
3. **Client Tesseract** — large WASM, poor CJK medical forms, bypasses the AI seam.
4. **Call a paid OCR vendor from M7** — no keys in CI; Echo owns the gateway.

**Grill:** *What if the mock returns prose instead of JSON?* Persist a single unconfirmed metric named `原文摘录` with the trimmed text, still encrypted, labelled 待确认. *Confirming overwrites metrics?* PATCH `{ confirmed: true, metrics?: [...] }`.

### D4 — Caregivers never see wellness data

**Chosen:** Wellness routes take `AuthUser` only. No `{elder_id}` path, no caregiver override. A linked caregiver requesting another user's water/sleep/cycle/report/plan id gets 404. Device sessions authenticated as the elder are the elder (tablet), not a caregiver viewport.

**Rejected:**

1. **Reuse M3 `authorize_elder_access` so children can log water for parents** — PO: never. Health data is not meds/tutorials.
2. **Opt-in share flag like `activity_log_opt_in`** — extra consent product; out of v1.
3. **403 for caregivers** — confirms the resource exists; 404 matches T1/M2/M3 owner isolation.

**Grill:** *Elder tablet Device auth would show the elder's own wellness.* Correct: the principal is the elder. Caregiver JWTs stay the caregiver's `user_id`.

### D5 — Water reminders

**Chosen:** Expand interval windows into fixed `HH:MM` times stored as `well_reminders` rows (`time_local` + `days_of_week` JSON 1–7 + `timezone`, default `Asia/Shanghai`). Reuse `elder::schedule::{parse_hhmm, validate_days, next_occurrence}` with no behaviour change. Each active row upserts a `scheduled_jobs` `web_push` job whose payload `type` is `wellness.water`. `wellness::maintain_reminders` on each scheduler tick (and on today/reminders reads) schedules the next occurrence after a job completes. Defaults: 2000 ml, every 2 hours from 08:00 through 22:00 inclusive (08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00), all ISO weekdays. Seeded lazily on first `GET /today` / `GET /reminders`.

**Rejected:**

1. **Self-re-enqueue every N minutes** — hard to cancel; drifts; fights T1's pending-job model.
2. **Client Notification / setTimeout only** — dies with the tab; iOS Safari has no Background Sync.
3. **Adaptive AI timing** — liability and non-determinism for a hydration ping.
4. **Cron strings** — M3 already rejected cron; helpers speak HH:MM + weekdays.

**Grill:** *Inclusive end?* Yes: 09:00–13:00 / 2 h → 09:00, 11:00, 13:00 (draft scenario). *Public `POST /v1/jobs` still only allows `web_push`.* M7 inserts those rows itself, same as M2/M3. Payload `type` distinguishes wellness. *POST with `interval_hours` replaces that kind's rows* so a user can reset the schedule without 8 manual deletes.

### D6 — Cycle prediction

**Chosen:** Mean of the last ≤6 start-to-start lengths. If fewer than two starts, length defaults to 28. Next start = last start + rounded mean. Fertile window = (next start − 14 − 5) .. (next start − 14 + 1), clamped. Response includes `label: 仅供参考` and the 非医疗建议 disclaimer. No contraception copy.

**Rejected:**

1. **AiGateway prediction** — extra liability, non-testable, no accuracy gain on sparse logs.
2. **Fixed 28-day calendar method only** — worse than using the user's own lengths when present.
3. **No prediction surface** — issue #18 asks for average-based prediction; the label is the safety valve.
4. **Standard-deviation bands as medical “late/early”** — implies diagnosis.

**Grill:** *End date vs next start for length?* Start-to-start is the usual cycle length; period duration is a separate display field.

### D7 — Encryption scope

**Chosen:** Encrypt cycle symptoms, sleep notes, and report metrics JSON via `FieldCrypto` (`nonce || AES-256-GCM`). Dates, ml, quality 1–5, flow_level, titles stay plaintext for rings and charts. Empty notes/metrics are SQL NULL.

**Rejected:**

1. **Encrypt everything** — cannot `SUM(ml)` or chart quality without decrypting every row in the handler.
2. **Encrypt nothing (draft v1 plaintext)** — PO requires AES-GCM for those three fields; they are special-category.
3. **Client E2E of the whole module** — breaks multi-device rings, scheduler copy, and T1 export.
4. **SQLCipher** — T1 already rejected database-wide encryption for phones; reuse `FieldCrypto`.

### D8 — Paths, crate layout, shared hunks

**Chosen:** `api/src/wellness/{mod,water,sleep,cycles,reports,plans,reminders}.rs` exposing `pub fn router() -> Router<AppState>`, merged in `routes.rs`. Web at `web/src/routes/wellness/` plus `web/src/lib/wellness/`. Shared hunks only: `lib.rs` module, router merge, export JSON key, one scheduler tick. Wellness HTTP client lives in `web/src/lib/wellness/`, not T2 `QingxinApi`.

**Rejected:**

1. **`qingxin/server` + `/api/v1/health` as in older PLAN.md** — orphans the merged crate.
2. **Append handlers to `routes.rs`** — that file is already huge; M6 would collide.
3. **A shared `/v1/records` across M6/M7/M8** — weak typing; M2 already rejected this.
4. **Move schedule helpers into `api/src/schedule.rs` now** — behaviour-preserving extract would edit elder tests and M3 files while M6 is in flight. Reuse `crate::elder::schedule` from wellness.

### D9 — Copy, theming, AI plans

**Chosen:** Constant `DISCLAIMER = "本模块为生活习惯记录工具，不构成医疗建议。身体不适请及时就医。"` on every wellness JSON that is a page payload (`today`, prediction, reports, OCR, plan suggest) and as a Svelte `Disclaimer` component on every wellness route. Pages use `rem` / `text-base` and `var(--qx-font-size, 1rem)`, `var(--qx-text)`, `var(--qx-bg)`. No local elder toggle. `POST /v1/wellness/plans` creates deterministic templates (`water_21`, `sleep_21`, default 21 days). `POST /v1/wellness/plans/suggest` calls `state.ai.complete` and returns a suggestion (not stored) with the disclaimer.

**Rejected:**

1. **Module-local large-text switch** — PO: global `html.elder` owned by T2/M3.
2. **Force a green/teal theme on `:root`** — shared `layout.css`; M6 would conflict. Scope any extra tokens under `.qx-wellness`.
3. **Call DashScope from the Svelte page** — bypasses the seam.
4. **Always-501 insight endpoint with no body** — OCR and plan-suggest are real seams even when mocked.

### D10 — Defaults and migration number

**Chosen:** Water 2000 ml/day, cup 250 ml, reminders every 2 h 08:00–22:00 inclusive. Migration `0006_wellness.sql` on this branch; if M6 (or another module) claims 0006 on main, renumber to the next free file at PR time without changing SQL.

**Rejected:**

1. **Keep draft `0007_wellness.sql` forever** — leaves a gap and confuses sqlx ordering if 0006 never appears.
2. **Hard-code 0006 in the OpenSpec tasks as immovable** — parallel M6 is called out in the user brief.
3. **8×250 ml cups as the only log unit** — users can POST any positive `ml`.

## Design review (self-grill)

**Proposer:** Thin module on T1 primitives: owner AuthUser, FieldCrypto on three columns, HH:MM reminders via M3 helpers + web_push jobs, AiGateway stubs, Svelte routes that inherit tokens.

**Reviewer pushback:**

1. *Naming the HTTP module `wellness` while the product card still says 健康 is inconsistent.* — Avoids the `/health` clash; the catalog slug and zh-CN title stay 健康.
2. *403 for missing cycle consent vs 404 for cross-user ids is two codes for “you cannot see this”.* — Different threats: consent is the owner's flag (actionable in UI); 404 hides another person's id.
3. *Reusing `elder::schedule` couples M7 to M3.* — Smaller than copying helpers or editing elder files during a parallel M6 land. A later extract can move both in one PR.
4. *Lazy default reminders surprise users who never wanted push.* — Jobs only fire if T1 has a push subscription; in-app today still shows times. Users can DELETE reminders.
5. *Deleting cycles on consent revoke is irreversible.* — That is the PIPL point; the toggle copy MUST say 关闭后将删除经期记录.
6. *Inclusive 22:00 makes eight pings a day.* — Matches “every 2 hours between 08:00 and 22:00”; user can replace the set.
7. *Metrics-only reports disappoint users with PDFs.* — Honest v1; OCR stub takes pasted text. File pipeline needs object storage.
8. *A scheduler hook in `scheduler.rs` fights “wellness files only”.* — One `maintain_reminders` call is how M2 rolls subscription jobs when nobody opens the app.

**Revisions after grilling:**

- Capability `qingxin-wellness`; routes `/v1/wellness`; catalog slug `health` redirects.
- Explicit period consent, default off, delete on revoke.
- Metrics-only reports; OCR and plan-suggest through AiGateway.
- Caregivers 404; no elder-scoped wellness.
- Interval expansion inclusive of window end; default 08:00–22:00 / 2 h / 2000 ml.
- Encrypt symptoms, sleep notes, report metrics; dates/ml/quality plaintext.
- Disclaimer constant + 仅供参考 on predictions.
- Migration 0006, renumber at PR if needed.

## Risks / Trade-offs

- **[Risk] M6 takes migration 0006** → Mitigation: at PR time, `git fetch origin main`, if `0006_*.sql` exists, rename to `0007_wellness.sql` (or next). SQL unchanged.
- **[Risk] `openapi.yaml` merge conflicts** → Mitigation: append Wellness paths after existing modules; rebase onto latest main before opening the PR; do not force-push.
- **[Risk] `routes.rs` / `scheduler.rs` conflict with M6** → Mitigation: one-line merge and one-line tick; do not reformat.
- **[Risk] Average prediction treated as medical fact** → Mitigation: `label` 仅供参考 and disclaimer on the JSON and the page; no contraception copy.
- **[Risk] Push without a browser subscription is a log-only send** → Mitigation: T1 `LogPushSender` / `RecordingPushSender`; in-app ring still works.
- **[Risk] Reusing elder schedule helpers looks like a dependency on elder UX** → Mitigation: import the functions only; no elder tables or AuthZ.

## Migration Plan

1. Land additive `0006_wellness.sql` (no down migration in the SQLx folder; drop tables only if the PR is reverted).
2. Ship OpenAPI + handlers + web routes on this branch.
3. Rollback: revert the PR; no production wellness data yet.

## Open Questions

None that block implementation. PO closed naming, period consent, metrics-only reports, caregiver visibility, water defaults, encryption fields, disclaimer, and migration numbering.
