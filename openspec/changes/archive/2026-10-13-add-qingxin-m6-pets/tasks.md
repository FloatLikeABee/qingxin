# Tasks

## 1. Contract and migration

- [x] 1.1 Add Pets paths and schemas to `api/openapi.yaml` (including `ExportPayload.pets`) and verify a grep that `/v1/pets`, `pet.due`, and `note_encrypted` are documented
- [x] 1.2 Write `api/migrations/0006_pets.sql` (`pet_pets`, `pet_health_records`, `pet_weights`, `pet_daily_logs`, `pet_reminders`) and verify `sqlx::migrate!` still runs in `AppState::connect(Config::test())`

## 2. Pets API (TDD)

- [x] 2.1 Write failing `api/tests/pets.rs` cases for 401, cross-user 404, caregiver 404, pet CRUD, and encrypted vet notes
- [x] 2.2 Implement `api/src/pets/` profiles + records (AuthUser, AppError::NotFound, FieldCrypto) and verify those tests pass
- [x] 2.3 Write failing tests for due reminders (`pet.due` at day-before 09:00, `scheduler::tick_once` + `RecordingPushSender`) and edit/delete job replacement
- [x] 2.4 Implement due-job enqueue/cancel and verify those tests pass
- [x] 2.5 Write failing tests for gram weights, daily logs, today summary feed count, empty `days_of_week` 400, and `pet.care` enqueue
- [x] 2.6 Implement weights, logs, today, care reminders (reuse `elder::schedule`) and verify those tests pass
- [x] 2.7 Write failing tests for `POST /v1/pets/ai/care-tip` 501 `ai_unconfigured` and privacy export/delete cascade
- [x] 2.8 Add the AI stub, export hook, scheduler `after_job`, and router merge; verify those tests pass

## 3. Svelte pets module (TDD)

- [x] 3.1 Write failing Vitest cases for today counts, calendar marks, gram formatting, schedule validation, and disclaimer copy
- [x] 3.2 Implement `web/src/lib/pets/` store, calendar, weight chart helpers, and disclaimer constant; verify those unit tests pass
- [x] 3.3 Add `/pets`, `/pets/[id]`, `/pets/calendar`, `/pets/services`, and `/modules/pet` redirect using Quill kit tokens only; verify `npm test` and `npm run check`

## 4. Integration verification

- [x] 4.1 Run `cargo fmt --check --all`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace` in `api/` and verify they pass
- [x] 4.2 Run `npm run lint`, `npm run check`, `npm test`, and `npm run build` in `web/` and verify they pass
- [x] 4.3 Run `openspec validate add-qingxin-m6-pets --strict` and verify the change is valid

## Workflow follow-up

- Archive the change after implementation verification.
- Open a PR whose body includes `Refs #17`. Do not merge.
