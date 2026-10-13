# Tasks

## 1. Contract and schema

- [x] 1.1 Append Elder paths and schemas to `api/openapi.yaml` (today, reminders, ack, contacts, tutorials, fraud-scripts, number-flags, profile, activity, notices, sms-log, ai/explain) and verify the file still parses as OpenAPI 3.1
- [x] 1.2 Add `api/migrations/0002_elder.sql` for profiles, reminders, events, contacts, tutorials, fraud_scripts, number_flags, activity_log, notices, sms_log, content_editors plus seeds, and verify `sqlx::migrate!` applies on a T1 database

## 2. API authorization and binding reuse

- [x] 2.1 Write failing integration tests in `api/tests/elder.rs` for 401 without auth, 404 for a stranger, 404 after T1 link revoke, and Device-auth as the elder, then verify they fail for missing routes
- [x] 2.2 Implement `authorize_elder_access` plus `/v1/elder/today` on T1 `caregiver_links` (no new invite path) and verify those four tests pass

## 3. Reminders, jobs, and misses

- [x] 3.1 Write failing tests for time+weekday create, cron rejection, idempotent ack, scheduler `elder_reminder` push, missed-dose notice + sms_log, and no notice after ack, then verify they fail
- [x] 3.2 Implement reminder CRUD, next-occurrence scheduling, ack, T1 `web_push` jobs, `after_job` hook, notices, and sms_log, and verify the tests in 3.1 pass

## 4. Contacts, tutorials, fraud, activity, AI

- [x] 4.1 Write failing tests for encrypted contacts + 120/110, system tutorial seeds, stranger 404 on family tutorials, fraud seed sources, hashed number check, activity opt-in 404, caregiver cannot enable the log, and `POST /v1/elder/ai/explain` 501, then verify they fail
- [x] 4.2 Implement those handlers (AES-GCM phones, HMAC flags, editor-only PATCH, `AiGateway` explain) and verify the tests in 4.1 pass
- [x] 4.3 Nest `elder::router()` from `routes.rs`, call `elder::after_job` from `scheduler.rs`, add `pub mod elder`, and verify `cargo test` still passes T1 `foundation.rs`

## 5. Web elder mode and pages

- [x] 5.1 Write failing Vitest cases for elder-mode persist/apply and weekday schedule helpers, then verify they fail
- [x] 5.2 Add global 适老 tokens (`html.elder`), settings Switch, and boot-script class, without restyling kit components, and verify the tests in 5.1 pass
- [x] 5.3 Add `web/src/routes/elder/**` pages (home, contacts, guide, anti-fraud, family manage) with the reminder disclaimer, `tel:` actions, and TTS read-aloud, plus a client that can run against the mock or T1, and verify `npm test`, `npm run check`, and `npm run build`

## 6. Integration verification

- [x] 6.1 Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test` in `api/` and verify all pass
- [x] 6.2 Run `npm run lint`, `npm run check`, `npm test`, and `npm run build` in `web/` and verify all pass
- [x] 6.3 Run `openspec validate --strict` and verify the change passes

## Workflow follow-up

- Archive the change after verification (`openspec archive -y add-qingxin-m3-elder-assistant`).
- Open a PR whose body includes `Refs #8`. Do not merge.
