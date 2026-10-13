# Design

## Context

See proposal.md — Why. T1 (`api/`) already has JWT + `Authorization: Device`, `caregiver_invites` / `caregiver_links`, AES-GCM `FieldCrypto`, `scheduled_jobs` + `PushSender`, SMS stub flag, `AiGateway`, and cascade-on-delete users. T2 (`web/`) has the Quill kit, four theme modes, and a mock API client. The uploaded draft still says `qingxin/server`, `qingxin/web`, route-forced light, cron schedules, and a new invite path; PO decisions override those. M2 is editing shared files in parallel.

Superpowers self-grill (required): proposer vs skeptical reviewer, at least three alternatives per major decision, checked against the live tree.

## Goals / Non-Goals

**Goals:**

- Elder resources keyed by the elder’s T1 `user_id`, managed by the elder or a linked caregiver.
- Elder tablet stays signed in with a T1 device session; caregiver uses the existing invite → link → `POST /v1/devices` flow.
- Reminders are `{time, days_of_week, timezone}`; delivery is in-app modal + TTS plus a T1 `web_push` job; UI states they are not alarm-clock reliable.
- Missed un-acked doses create caregiver notices and an SMS-stub log row.
- Activity log hidden from caregivers until the elder sets `activity_log_opt_in`.
- Fraud cards are seed rows with source name + URL, PATCH-able by a content-editor grant.
- Global `html.elder` tokens; elder pages use ≥56px targets themselves.

**Non-Goals:**

- A second invite/PIN/WeChat bind or a new `Authorization` scheme.
- True remote desktop, caller-ID, call interception, or native alarm APIs.
- Video hosting; tutorial images/audio are external URLs.
- Medical advice, diagnosis, or guaranteed on-time dosing.
- Implementing Echo’s model providers, SSE, or cache.
- Restyling every Quill primitive when elder mode is on.
- Merging the PR (PO merges).

## Decisions

### D1 — Binding and elder login

**Chosen:** Reuse T1 `POST /v1/caregiver/invites`, `POST /v1/caregiver/accept`, `GET/DELETE /v1/caregiver/links`, and `POST /v1/devices`. M3 authorization is `caller == elder OR active caregiver_links row`. Elder tablets authenticate as the elder via `Authorization: Device`. No `elder_links` table and no `/v1/elder/links/*`.

**Assumptions challenged:** The draft’s invite (6-digit, 10 min) duplicates T1 (8-char, hashed, TTL from config). PO: “Elder login REUSES T1’s caregiver-issued long-lived device sessions. Do not build a new auth path.”

**Rejected:**

1. **New `elder_links` + 6-digit codes** — two bind systems, two revoke paths, and a second auth story the PO forbade.
2. **Caregiver-owned sub-account with no elder user** — deletion/consent/export break; the tablet still needs a principal. T1 already solved this with device sessions.
3. **Delegated JWT whose `sub` is the elder** — token theft is a full account takeover and audit trails lie about the actor.
4. **Header `X-Acting-For` impersonation** — invisible in URLs and easy to misuse on shared browsers.

**Grill:** *T1 invites last up to a day; the draft wanted 10 minutes.* Accept T1 TTL (env `CAREGIVER_INVITE_TTL_SECS`) rather than fork invites. *T1 links have no per-permission JSON.* v1 treats an active link as reminders+contacts+tutorials; `view_log` is the elder-wide opt-in in `elder_profiles`. Finer grants can add a table later without a new auth path.

### D2 — Reminder schedule and delivery

**Chosen:** Store `time_local` (`HH:MM`), `days_of_week` (ISO 1=Mon … 7=Sun JSON array), and `timezone` (default `Asia/Shanghai`, mapped to a fixed offset). On create/update, insert an `elder_reminder_events` row for the next occurrence and two `scheduled_jobs` of kind `web_push`: one at the occurrence (`type=elder_reminder`) and one at occurrence+60m (`type=elder_miss_check`). The elder UI also polls `/v1/elder/today` and shows a blocking modal + `speechSynthesis` (zh-CN). Visible copy: reminders are not alarm-reliable.

**Rejected:**

1. **Spec `schedule_cron`** — unreadable in a caregiver picker, tz-ambiguous, and PO said time plus weekdays.
2. **Web Push only** — iOS needs an installed PWA and elders deny permission; in-app fallback is required.
3. **Notification Triggers / native wrapper alarms** — not available to this PWA; out of scope.
4. **Pre-rendered TTS via the AI gateway** — optional later (`voice_url`); browser TTS works offline and does not need Echo.

**Grill:** *PWA cannot guarantee dosing.* Honest limitation, shown on elder home and the due modal; missed-dose path is the safety net, not a clock. *T1 `POST /v1/jobs` only allows `web_push`.* M3 inserts those rows itself (same table/kind) so the public jobs validator stays untouched. *60-minute miss window is arbitrary.* Documented constant `MISS_GRACE`; change later without a schema break.

### D3 — Missed-dose escalation

**Chosen:** When the miss-check job runs, if that occurrence is not `acked`, mark it `missed`, insert `elder_notices` for every linked caregiver, and insert `elder_sms_log` (purpose `missed_dose`) using T1’s SMS stub semantics (record + log; no carrier). Caregivers read notices at `GET /v1/elder/notices`.

**Rejected:**

1. **Push to the elder only** — PO requires caregiver notice + SMS stub.
2. **Real SMS vendor now** — T1 has no sender trait, only `QINGXIN_SMS_STUB`.
3. **Lazy detection only on next `/today` read** — works offline-unfriendly for caregivers who never open the elder page; the scheduled job is the source of truth, with lazy backfill as a belt.
4. **Phone-blast every linked caregiver’s raw number from a new dialer** — phones stay encrypted; we notify through T1 identity + stub log.

**Grill:** *What if the elder acks at minute 59?* Unique `(reminder_id, occurrence_at)` and the hook no-ops when status is already `acked`. *What if push failed?* Miss-check still runs; notice/SMS do not depend on the first push succeeding.

### D4 — Privacy of the activity log

**Chosen:** Always write `elder_activity_log` events (`reminder_acked`, `tutorial_opened`, `call_tapped`) with no call audio or raw phone. `GET` is allowed to the elder always, and to a linked caregiver only when `elder_profiles.activity_log_opt_in = 1`. Otherwise 404.

**Rejected:**

1. **On by default** — PO: opt-in by the elder; draft Q3 resolved the same way.
2. **Per-link `view_log` permission JSON on a new bind table** — extra UI for v1; elder-wide opt-in matches the PO sentence.
3. **No log at all** — caregivers then cannot see missed context even after consent.
4. **Store the dialed number in the log** — leaks a third-party phone into an exportable audit.

**Grill:** *Writing while hidden still stores data.* Needed so enabling the toggle is not empty; export/delete still cover the rows. Disclose on the opt-in switch.

### D5 — Elder-friendly display

**Chosen:** Global setting `qingxin.elderMode` (localStorage) + `html.elder` class applied in the T2 boot script and settings Switch. Tokens only: 18px root, stronger `--qx-text` / `--qx-muted` / `--qx-line` in both light and dark. Elder routes use `min-h-14` themselves. Theme modes stay as they are.

**Rejected:**

1. **Force light/high-contrast only on `/elder`** — draft D5; PO says global, and a caregiver with dark mode would flash when opening family pages.
2. **Separate elder PWA** — double install, double SW, out of M3 file budget.
3. **Restyle every kit component when the flag is on** — PO: do not restyle the whole kit.
4. **Ignore the spec’s 18px/56px rule** — still required on elder pages; just not via a route theme override.

**Grill:** *Global 18px will make finance/mood look different.* That is the point of a global toggle; default remains off. *T2 palette tests assert exact spec 1.3 colors.* Elder tokens override CSS variables only when the class is present; `palette` constants stay unchanged.

### D6 — Anti-fraud content

**Chosen:** Table `fraud_scripts` with `title`, `body`, `source_name`, `source_url`. Seed a handful of 话术 cards (冒充公检法, 刷单返利, 虚假投资, 客服退款) citing public 国家反诈中心 / official republications. `GET` is authenticated search. `PATCH` only if the caller is in `elder_content_editors` (ops-granted; tests insert a row). Number flags store `HMAC(phone)` per user; check returns `{ flagged, count }` without identities.

**Rejected:**

1. **Hard-code scripts in Rust/Svelte** — not admin-editable.
2. **Crowd-sourced raw number dump** — third-party PII; HMAC + counts only.
3. **Unattributed copy** — PO requires a public 国家反诈中心 citation on each item.
4. **Open write for every user** — vandalism; editor grant is the admin seam.

**Grill:** *Who is the first editor in production?* Ops inserts `elder_content_editors`. Empty table means read-only seed, which is correct for launch.

### D7 — API shape and 404-vs-403

**Chosen:** `/v1/elder/...` with `{elder_id}` (or `me`) on resource paths. Shared lists (`fraud-scripts`, `tutorials/system`, `notices`) are not elder-scoped. Unauthorized cross-user access returns **404** (hide existence). Missing/invalid credentials return **401** from `AuthUser`. After T1 link delete, the same caregiver gets 404.

**Rejected:**

1. **Parallel `/v1/family/*` duplicates** — two handlers, drift.
2. **403 for strangers** — confirms the elder id exists.
3. **Websocket config push** — elder home + SW focus poll is enough for v1.

**Grill:** *Caregiver PATCH of the elder’s opt-in?* 404 — only the elder may change `activity_log_opt_in`.

### D8 — AI

**Chosen:** Browser `speechSynthesis` for 朗读. Optional `POST /v1/elder/ai/explain` calls `state.ai.complete` and maps `AiError::Unconfigured` to 501 `ai_unconfigured`. No provider clients in M3.

**Rejected:**

1. **Inline DashScope/Qwen calls** — races Echo and violates the seam.
2. **Skip any AI route** — then M3 has no proven hook; a tiny explain stub documents the rule.
3. **Server-side TTS files at write time** — needs a working gateway and blob storage.

### D9 — File boundaries (M2 conflict)

**Chosen:** New files for almost everything. Shared hunks: `lib.rs` (`pub mod elder`), `routes.rs` (`.merge(elder::router())`), `scheduler.rs` (call `elder::after_job` after a successful send), OpenAPI append, settings Switch, `layout.css` tokens, `app.html` boot class, module placeholder button.

**Rejected:**

1. **Append 800 lines to `routes.rs`** — guaranteed M2 merge pain.
2. **New columns on `caregiver_links`** — T1 table, extra migration conflict.
3. **New job `kind` that changes `POST /v1/jobs` validation** — touches T1 tests and OpenAPI jobs enum.

## Design review (self-grill)

**Proposer:** Thin domain on top of T1 seams. Honest PWA reminder limits. Global elder mode as tokens.

**Reviewer pushback:**

1. *Reusing T1 links loses the draft’s 10-minute 6-digit UX.* — Invite UX is T1’s; M3 family pages deep-link to that flow. PO forbade a new auth path.
2. *Inserting `web_push` jobs from M3 couples modules to the jobs table.* — That table is the T1 scheduler contract. A new kind would be a bigger shared edit.
3. *SMS stub is not SMS.* — Same as T1 OTP: recorded, not sent. Tests assert the log row.
4. *Global elder mode plus dark high-contrast may look harsh.* — Spec 模块三 wanted high contrast; we do not force light.
5. *Seeded fraud copy can be legally sensitive.* — Short paraphrases + source URL; not legal advice; disclaimer on the page.
6. *`after_job` in `scheduler.rs` is still a shared edit.* — Three lines vs forking the ticker.

**Revisions after grilling:**

- Dropped `elder_links` and `/links/invite`.
- Schedule is time + weekdays, not cron or RRULE.
- Elder mode is global tokens, not a route theme override.
- Missed dose uses notices + SMS log, not a vendor.
- AI is explain-stub only.
- Shared files limited to wiring.

## Risks / Trade-offs

- **[Risk] AuthZ bugs leak another family’s meds** → `authorize_elder_access` on every scoped handler; tests for stranger 404, revoke 404, 401, device-as-elder.
- **[Risk] PWA reminders silently fail** → Disclaimer + caregiver miss notices.
- **[Risk] OpenAPI/settings/CSS conflicts with M2** → Append-only OpenAPI; isolated CSS class; one Switch block.
- **[Risk] SQLite ephemeral disk** → Same as T1; schema is portable.
- **[Risk] Fraud seed goes stale** → Editor PATCH; no in-app legal claims.
- **[Risk] Fixed-offset tz map is not DST-aware** → Product is CN-first (`Asia/Shanghai` has no DST).

## Migration Plan

1. Additive `0002_elder.sql` + seeds. Down is drop those tables (dev only).
2. Ship `/v1/elder/*` and web pages.
3. Rollback: revert the PR; T1 tables unchanged.
4. Account delete: existing `ON DELETE CASCADE` from `users` clears M3 rows.

## Open Questions

None that block M3. WeChat bind, real SMS, and native alarms wait for later modules.
