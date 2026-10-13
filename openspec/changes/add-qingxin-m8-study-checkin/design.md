# Design

## Context

See proposal.md — Why. T1 lives at `api/` (`qingxin-api`, Axum 0.8, SQLx SQLite, `AuthUser`, `AppError`, `FieldCrypto`, `scheduled_jobs` + `PushSender`, `AiGateway`). T2 lives at `web/` (SvelteKit 5, Quill kit, CSS tokens). Latest main is `ddb795c` (M4 local life on top of M7). M2 finance already has savings challenges with idempotent daily check-ins; M3 elder already owns `parse_hhmm` / `validate_days` / `next_occurrence`; M7 wellness already has 21-day plans, encrypted free text, and `maintain_reminders` on the scheduler tick. The draft still said `qingxin/server`, `qingxin/web`, provisional `0008`, community 氛围, photo 错题, and Morph notes; PO decisions override those.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per major decision, checked against the live tree.

## Goals / Non-Goals

**Goals:**

- 7/14/21-day named challenges with at most one check-in per local day and a derived current streak (timezone-correct).
- Text 错题本 (flashcards) with SM-2-lite ease/interval/next_review_date; AI category stub the user can override.
- Study notes stored as encrypted Markdown, searched by title and tags only, separate from any other notes product.
- User-built skill tree with optional built-in templates that copy into the caller's tree.
- Missed-day Web Push skipped when the user already checked in that local day; review reminders via the same scheduler.
- Browser-only pomodoro + white noise; kit tokens only so `html.elder` applies.
- Owner isolation (404/401), privacy export/delete, OpenAPI contract.

**Non-Goals:**

- Community, shared challenges, leaderboards, or moderation of public study posts.
- Photo/file capture for 错题, object storage, or OCR of worksheets.
- Device lock / 锁机, native alarm APIs, or server-side focus sessions.
- Reusing Morph notes, M1 mood notes, or M7 sleep notes tables.
- Stored streak counters, FSRS/Anki full SM-2, or AI-scheduled reviews.
- Restyling Quill kit primitives or a module-local elder toggle.
- Merging the PR (PO merges).

## Decisions

### D1 — Streak storage

**Chosen:** Derive `current_streak` from `study_checkins` at read time in the challenge timezone. A day counts once (`UNIQUE (challenge_id, day)`). Repeat POST of the same local day returns 200 with the existing row. Streak is the run of consecutive dates ending on today if today is checked in, otherwise yesterday if yesterday is checked in, otherwise 0.

**Assumptions challenged:** Spec lists `current_streak` on the challenge row; drafts often persist a counter.

**Rejected:**

1. **Stored counter column updated on check-in** — drifts when timezone, backfill, or idempotent retries disagree; M7 plans already count with `SELECT COUNT(*)`.
2. **Client-computed only** — two clients can disagree; API `today` and export would lie.
3. **Calendar heatmap of “did anything” across all challenges as the streak** — PO: streaks come from check-ins on a challenge, at most one per day.

**Grill:** *≤21 rows, so derive is cheap.* Yes. *What if today is unchecked but yesterday is checked?* Streak still includes yesterday until the local day rolls over — that is how habit apps avoid zeroing a streak at 00:01. *Explicit `day` in the body vs server clock?* Accept `YYYY-MM-DD`; default to `local_date(challenge.timezone, now)` using M3 `tz_offset` (UTC vs Asia/Shanghai). Tests cover consecutive days, a gap resetting to 0, duplicate same-day, and UTC vs Shanghai date keys.

### D2 — Review algorithm

**Chosen:** SM-2-lite on each flashcard: `ease` (default 2.5, floor 1.3), `interval_days` (new cards start at 0), `next_review_date`. Grades: `again` / `hard` / `good` / `easy`. `good` at interval 1 becomes interval 6 (classic SM-2). Pure function in `api/src/study/review.rs` plus a mirrored `web/src/lib/study/review.ts` for the due list. Deterministic, unit-testable, no network.

**Rejected:**

1. **Fixed Leitner boxes** — fewer knobs but PO asked for simple spaced review, not boxes.
2. **Full Anki SM-2 / FSRS** — extra state (lapses, fuzz, learning steps) and harder tests than v1 needs.
3. **AI-scheduled next_review** — non-deterministic, needs Echo, fails CI without keys.
4. **No scheduling; due = all cards** — not a 错题本.

**Grill:** *Why encrypt front/back if category is plaintext?* Category is a user-chosen filter tag; the prompt/answer can contain personal study content. *Grade enum vs 0–5 quality?* Enum matches the UI buttons and the spec scenario (“graded good”).

### D3 — Note search with encrypted content

**Chosen:** `content_md_encrypted` BLOB via `FieldCrypto`. `title` and `tags` (JSON array, plaintext) are searchable with `q`. GET decrypts Markdown only for the owner. Notes live in `study_notes`, not Morph, mood, or wellness tables.

**Rejected:**

1. **Plaintext Markdown + SQLite FTS** — PO: encrypt sensitive notes.
2. **Client-side search after decrypting the whole library** — leaks full bodies into every list payload and breaks pagination.
3. **HMAC lookup on content** — cannot substring-search; titles/tags already cover the PO rule.
4. **Reuse a Morph notes API** — PO: study notes are separate.

**Grill:** *Tags in a JSON text column vs a join table?* JSON matches M3 `days_of_week` and keeps the migration additive. Search is `title LIKE` / `tags LIKE` for v1.

### D4 — 锁机 and focus timer

**Chosen:** Focus timer is browser-only (25/5 pomodoro + white-noise mixer patterned on M1 `NoiseMixer`). No API, no job, no 锁机. The focus route uses kit tokens (`bg-[var(--qx-bg)]`, `text-[var(--qx-text)]`) so dark theme already reduces glare; do not hard-code a forced palette.

**Rejected:**

1. **Fullscreen + visibility nag as fake lock** — hostile and trivial to dismiss; still not 锁机.
2. **Native wrapper / kiosk** — out of this PWA.
3. **Server-side session rows** — PO: browser only; ephemeral disk would drop them anyway.

**Grill:** *Spec 模块八 said 强制深色 for 专注.* Global dark/night-only already exists; a local forced-dark would fight `html.elder` and the four theme modes. Tokens inherit whatever the user chose.

### D5 — 断签提醒 skip-if-checked-in

**Chosen:** Store reminder rules as HH:MM + ISO weekdays + timezone (M3 helpers). Each active reminder enqueues `scheduled_jobs.kind = web_push` with payload `type=study.streak` or `study.review`. In `scheduler::tick_once`, before `PushSender::send`, call `study::should_skip_push`. If the payload is `study.streak` and the user already has a `study_checkins.day` equal to today in that reminder timezone, mark the job `done` and do **not** record a `PushMessage`. `maintain_reminders` then schedules the next occurrence.

**Rejected:**

1. **Always send** — PO: skip if already checked in.
2. **Client-only Notification API** — iOS needs an installed PWA; the T1 scheduler is the contract M3/M7 already use.
3. **Cancel the pending job at check-in only** — races if the job is already due when they check in; the tick-time check is the source of truth. Check-in still cancels a pending streak job as a belt.
4. **New public job kind** — would change T1 `POST /v1/jobs` validation; insert `web_push` rows like M7.

**Grill:** *Shared `scheduler.rs` edit with M6.* Three lines plus `study::maintain_reminders()` at the bottom, same shape as wellness. *Skip review jobs too?* No — PO only mentioned missed-day.

### D6 — Skill tree source

**Chosen:** User-built `study_skill_nodes` (`parent_id`, `title`, `unlocked`, `sort_order`). `GET /v1/study/skills/templates` returns in-code templates (英语词汇, 钢琴). `POST /v1/study/skills/from-template` copies nodes for that user. Unlock is a PATCH the owner controls.

**Rejected:**

1. **Seed templates as global DB rows** — extra table and admin PATCH; two templates are static.
2. **User-built only, no templates** — PO asked for optional built-in templates.
3. **Server-owned progression DAG the user cannot edit** — not “user-built”.

**Grill:** *Cycles in parent_id?* Reject a parent that is not the caller's or that would cycle. *Unlock children when parent is locked?* Allowed in v1; the UI can dim them.

### D7 — API shape, 404, timezone, files

**Chosen:** `/v1/study/...`. Cross-owner 404, missing token 401. Challenge timezone defaults to `Asia/Shanghai` (`UTC` accepted). Migration `0009_study.sql`. New files for almost everything; shared hunks: `lib.rs` (`pub mod study`), `routes.rs` (merge + export), `scheduler.rs` (skip + maintain), OpenAPI append, modules redirect.

**Rejected:**

1. **`/v1/learn` or `/v1/checkin`** — catalog slug is `study`.
2. **403 for strangers** — confirms the id exists.
3. **Reuse `fin_savings_challenges`** — different rules (7/14/21, timezone, study reminders).
4. **Append handlers to `routes.rs`** — M6 conflict magnet.

**Grill:** *Why 0009?* Main has `0007_local.sql` after M4; unmerged M6 PR #22 has `0008_pets.sql`.

### D8 — AI

**Chosen:** `POST /v1/study/flashcards/classify` calls `state.ai.complete` and maps `AiError::Unconfigured` to 501. The user may ignore the category and set their own on create. No other model calls required for v1.

**Rejected:**

1. **Inline DashScope** — races Echo.
2. **Skip AI entirely** — then M8 has no proven seam; the draft listed auto-categorise.
3. **Auto-write category without an override** — PO: user can override.

## Design review (self-grill)

**Proposer:** Thin domain on T1 seams. Derived streaks. Encrypted notes with metadata search. Tick-time skip for nags.

**Reviewer pushback:**

1. *Finance already has challenges.* — Different product (money vs study) and different streak/reminder rules; copying the check-in idempotency pattern is enough.
2. *Skipping in `scheduler.rs` couples modules.* — Same as `elder::after_job` and `wellness::maintain_reminders`. A new job kind would be a bigger shared edit.
3. *SM-2-lite is not real SM-2.* — Interval 1 → 6 on `good` is the spec scenario; fuzz and learning steps can wait.
4. *Title/tag search misses body hits.* — PO: search titles and tags only because bodies are encrypted.
5. *Templates in code go stale.* — Two short trees; users can edit after copy.
6. *Focus timer will not survive a killed tab.* — Honest PWA limit; no 锁机.

**Revisions after grilling:**

- Locked migration to `0009_study.sql`.
- Streak derived, not stored.
- Skip-if-checked-in at tick time, not only at check-in.
- Notes are `study_notes` with encrypted Markdown.
- No community, no photos, no 锁机.
- Shared files limited to wiring.

## Risks / Trade-offs

- **[Risk] Migration/OpenAPI conflict with M6** → `0009` reserved after M4 `0007` and M6 `0008`; append-only OpenAPI; tiny scheduler/routes hunks.
- **[Risk] Timezone off-by-one on streaks** → store `day` as `YYYY-MM-DD` in the challenge tz; tests for UTC vs Shanghai and a missed-day gap.
- **[Risk] AuthZ leaks another user's 错题** → `user_id` on every table; load_one by `(id, user_id)`; 404 tests per resource.
- **[Risk] PWA reminders silently fail** → same T1 Web Push path as M7; skip avoids nagging people who already did the work.
- **[Risk] SQLite ephemeral disk** → same as T1; schema is Postgres-ready TEXT ids.

## Migration Plan

1. Additive `0009_study.sql`. Down is drop those tables (dev only).
2. Ship `/v1/study/*` and web pages.
3. Rollback: revert the PR; T1 tables unchanged.
4. Account delete: `ON DELETE CASCADE` from `users` clears M8 rows.

## Open Questions

None that block M8. Community, photo 错题, Morph notes, and 锁机 are explicitly out of v1.
