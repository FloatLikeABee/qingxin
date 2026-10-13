# Tasks

## 1. Contract and migration

- [ ] 1.1 Add Study paths and schemas to `api/openapi.yaml` (including `ExportPayload.study` and the study disclaimer field) and verify a grep that `/v1/study/today` and `content_md_encrypted` semantics are documented
- [ ] 1.2 Write `api/migrations/0008_study.sql` (study_* tables, ON DELETE CASCADE, UNIQUE challenge+day) and verify `sqlx::migrate!` still runs in `AppState::connect(Config::test())`

## 2. Study API (TDD)

- [ ] 2.1 Write failing `api/tests/study.rs` cases for 401, cross-user 404, caregiver 404, invalid target_days, 7/14/21 create, idempotent check-in, consecutive streak, gap reset, and UTC vs Shanghai date keys
- [ ] 2.2 Implement `api/src/study/` challenges + today (AuthUser, AppError, derived streak, challenge timezone) and verify those tests pass
- [ ] 2.3 Write failing tests that flashcard front/back and note Markdown are not plaintext at rest, search misses body text, good-at-interval-1 advances SM-2-lite, classify uses `QingxinAiGateway::mock`, unconfigured AI returns 501, and file_url is rejected
- [ ] 2.4 Implement flashcards, review.rs, notes, skills/templates and verify those tests pass
- [ ] 2.5 Write failing tests that a due `study.streak` job skips `RecordingPushSender` after check-in and still notifies when the day is missed, and that `tick_once` delivers `study.review`
- [ ] 2.6 Implement reminders + `should_skip_push` + `maintain_reminders` (reuse `elder::schedule`) and verify those tests pass
- [ ] 2.7 Write failing tests that export JSON contains decrypted study records and account delete leaves zero study_* rows
- [ ] 2.8 Add export/delete hooks (and the small scheduler tick) and verify those tests pass

## 3. Svelte study module (TDD)

- [ ] 3.1 Write failing Vitest cases for derived streak (consecutive, gap, same-day), SM-2-lite good-at-1, title/tag search excluding body, disclaimer constant, and pomodoro remaining time
- [ ] 3.2 Implement `web/src/lib/study/` streak, review, search, timer, store, disclaimer helpers and verify those unit tests pass
- [ ] 3.3 Add `/study`, `/study/checkin`, `/study/cards`, `/study/notes`, `/study/skills`, `/study/focus` plus `/modules/study` redirect using Quill kit, Flame/SkillGraph with tokens, Disclaimer component, and inherited `--qx-font-size`; verify `npm test` and `npm run check`

## 4. Integration verification

- [ ] 4.1 Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test` in `api/` and verify they pass
- [ ] 4.2 Run `npm run lint`, `npm run check`, `npm test`, and `npm run build` in `web/` and verify they pass
- [ ] 4.3 Run `openspec validate --strict` and verify the change is valid

## Workflow follow-up

- Archive the change after implementation verification.
- Rebase or merge the latest main (keep `0008` unless main has taken it). Open a PR whose body includes `Refs #19`. Do not merge.
