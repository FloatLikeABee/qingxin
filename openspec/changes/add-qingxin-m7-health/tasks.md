# Tasks

## 1. Contract and migration

- [ ] 1.1 Add Wellness paths and schemas to `api/openapi.yaml` (including `ExportPayload.wellness` and the 非医疗建议 disclaimer field) and verify a grep that `/v1/wellness/today` and `symptoms_encrypted` semantics are documented
- [ ] 1.2 Write `api/migrations/0006_wellness.sql` (well_* tables, cycle_consent default 0, ON DELETE CASCADE) using the next free number after main's latest, and verify `sqlx::migrate!` still runs in `AppState::connect(Config::test())`

## 2. Wellness API (TDD)

- [ ] 2.1 Write failing `api/tests/wellness.rs` cases for 401, cross-user 404, caregiver 404, invalid ml, 4×250 ml → 1000/2000, and default reminder expansion 08:00–22:00
- [ ] 2.2 Implement `api/src/wellness/` water + goals + today (AuthUser, AppError) and verify those tests pass
- [ ] 2.3 Write failing tests for cycle consent gating (POST without consent → 403, no row; revoke deletes rows) and average prediction 仅供参考
- [ ] 2.4 Implement cycles + consent + prediction and verify those tests pass
- [ ] 2.5 Write failing tests that symptoms, sleep notes and report metrics are not plaintext at rest, and that OCR uses `QingxinAiGateway::mock` while unconfigured AI returns 501
- [ ] 2.6 Implement sleep, reports, OCR stub, plans/checkins and verify those tests pass
- [ ] 2.7 Write failing tests for interval expansion 09:00–13:00 / 2 h → three times and a scheduled web_push job that `scheduler::tick_once` delivers via `RecordingPushSender`
- [ ] 2.8 Implement reminders + `maintain_reminders` (reuse `elder::schedule`) and verify those tests pass
- [ ] 2.9 Write failing tests that export JSON contains decrypted wellness (cycles omitted without consent) and account delete leaves zero well_* rows
- [ ] 2.10 Add export/delete hooks (and the one-line scheduler tick) and verify those tests pass

## 3. Svelte wellness module (TDD)

- [ ] 3.1 Write failing Vitest cases for water progress, inclusive interval expansion, mean cycle prediction labelled 仅供参考, consent gating (no local cycle rows without consent), and disclaimer constant
- [ ] 3.2 Implement `web/src/lib/wellness/` progress, schedule, cycle, store, disclaimer helpers and HTTP/memory clients and verify those unit tests pass
- [ ] 3.3 Add `/wellness`, `/wellness/record`, `/wellness/stats`, `/wellness/reports`, `/wellness/plans` plus `/modules/health` redirect using Quill kit, SVG ring, Disclaimer component, and inherited `--qx-font-size`; verify `npm test` and `npm run check`

## 4. Integration verification

- [ ] 4.1 Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test` in `api/` and verify they pass
- [ ] 4.2 Run `npm run lint`, `npm run check`, `npm test`, and `npm run build` in `web/` and verify they pass
- [ ] 4.3 Run `openspec validate --strict` and verify the change is valid

## Workflow follow-up

- Archive the change after implementation verification.
- Rebase or merge the latest main (take the next free migration number if 0006 is taken). Open a PR whose body includes `Refs #18`. Do not merge.
