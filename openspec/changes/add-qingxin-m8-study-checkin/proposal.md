# Proposal

## Why

Issue #19 (M8 学习与技能打卡) needs a private habit toolkit — 7/14/21-day challenges with derived streaks, a text 错题本 with simple spaced review, encrypted Markdown notes, a user-built skill tree, and a browser-only focus timer — after T1 (`api/`), T2 (`web/`), M2 finance, M3 elder, M7 wellness, and M10 hustle merged. The uploaded draft assumed `qingxin/server` and `qingxin/web` and left OPEN-QUESTIONS.md; this change maps it onto the live tree and locks PO answers (no community/leaderboard, no photo capture, study notes stay separate and encrypted, skill tree is user-built with optional templates, streaks derived from at most one check-in per day, SM-2-lite review, missed-day reminders skip if already checked in, focus timer is client-only, migration `0009_study.sql` because main has `0007_local.sql` and in-flight M6 pets will take `0008`).

## What Changes

- Additive SQLx migration `api/migrations/0009_study.sql` for `study_challenges`, `study_checkins`, `study_flashcards`, `study_notes`, `study_skill_nodes`, `study_reminders`.
- Axum `api/src/study/` mounted at `/v1/study/*` behind T1 `AuthUser`. Cross-user ids return 404; missing tokens return 401 `unauthenticated`. Caregiver links MUST NOT grant study access.
- Challenge `target_days` MUST be 7, 14, or 21. Check-in is idempotent per `(challenge_id, day)` in the challenge timezone. `current_streak` is derived at read time from consecutive local days, not stored.
- Flashcard front/back and note Markdown stored with T1 `FieldCrypto` AES-256-GCM (`*_encrypted` BLOB). Titles, tags, dates, ease, and interval stay plaintext so lists and search work. Note search covers title and tags only.
- Missed-day (`study.streak`) and review (`study.review`) reminders reuse M3 `elder::schedule` (HH:MM + ISO weekdays) and enqueue T1 `scheduled_jobs` kind `web_push`. On tick, a streak job MUST skip `PushSender` if the owner already checked in that local day.
- Flashcard classify and optional skill-copy hints go through `AiGateway` stubs; unconfigured AI returns 501 `ai_unconfigured`. No file storage.
- Privacy export includes decrypted study records for the owner; account delete cascades `study_*` rows.
- SvelteKit routes under `web/src/routes/study/` using Quill kit components and inherited `--qx-font-size` / contrast tokens (global `html.elder` applies). Focus timer (pomodoro + white noise) is browser-only. Fixed 学习习惯工具 copy on home and AI output.
- Extend `api/openapi.yaml` with the Study tag and `ExportPayload.study`.

## Capabilities

### New Capabilities

- `qingxin-study`: owner-scoped study check-in — 7/14/21-day challenges with derived streaks, SM-2-lite flashcards, encrypted Markdown notes with title/tag search, user-built skill tree with optional templates, streak/review Web Push reminders that skip completed days, and a client-only focus timer.

### Modified Capabilities

- `privacy`: JSON export MUST include the caller's study records; account deletion MUST leave no `study_*` rows.
- `field-encryption`: flashcard front/back and study-note Markdown MUST be AES-256-GCM at rest.

## Impact

- Code: new `api/src/study/` and `api/tests/study.rs`; small mounts in `api/src/lib.rs`, `api/src/routes.rs` (export hook + router merge), and `api/src/scheduler.rs` (skip-if-checked-in + reminder maintenance).
- Web: new `web/src/lib/study/` and `web/src/routes/study/`; `web/src/routes/modules/study/+page.ts` redirect only. No T2 tab or theme-token rewrite; do not restyle kit primitives.
- Contract: `api/openapi.yaml` Study tag and `ExportPayload.study`.
- CI: existing `.github/workflows/qingxin.yml` (`api/**`, `web/**`).
- Parallel M6 pets: keep shared-file hunks tiny; M4 took `0007_local.sql`, M6 takes `0008`, this change uses `0009`.
