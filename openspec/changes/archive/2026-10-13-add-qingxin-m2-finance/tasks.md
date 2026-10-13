# Tasks

## 1. Contract and migration

- [x] 1.1 Add Finance paths and schemas to `api/openapi.yaml` (including `ExportPayload.finance`) and verify `python -c` / a grep that `/v1/finance/transactions` and `note_encrypted` semantics are documented
- [x] 1.2 Write `api/migrations/0002_finance.sql` (fin_* tables, COALESCE unique budget index, default categories) and verify `sqlx::migrate!` still runs in `AppState::connect(Config::test())`

## 2. Ledger API (TDD)

- [x] 2.1 Write failing `api/tests/finance.rs` cases for 401, cross-user 404, invalid amount_fen, three-step expense 2550/餐饮, and client_id idempotency
- [x] 2.2 Implement `api/src/finance/` categories + transactions (AuthUser, AppError, FieldCrypto notes) and verify those tests pass
- [x] 2.3 Write failing tests for summary budget alert (1000 yuan / 80% / 850 spent → 85% alert) and MoM/YoY report
- [x] 2.4 Implement summary + report + budgets and verify those tests pass
- [x] 2.5 Write failing tests for subscription upcoming + annual cost, next_billing_date roll-forward, and a scheduled web_push job that `scheduler::tick_once` delivers
- [x] 2.6 Implement subscriptions + `maintain_reminders` and verify those tests pass
- [x] 2.7 Write failing tests for manual challenge double check-in and verify they fail for the right reason
- [x] 2.8 Implement challenges and verify the check-in tests pass

## 3. Privacy hooks and encryption proof

- [x] 3.1 Write failing tests that note_encrypted is not plaintext, export JSON contains decrypted finance, and account delete leaves zero fin_* rows
- [x] 3.2 Add export/delete hooks (and the one-line scheduler tick) and verify those tests pass

## 4. Svelte finance module (TDD)

- [x] 4.1 Write failing Vitest cases for fen/yuan conversion, 3-step entry state, outbox client_id idempotency, annual cost, and red/green token helpers
- [x] 4.2 Implement `web/src/lib/finance/` money, entry, store, colours, and HTTP/memory clients and verify those unit tests pass
- [x] 4.3 Add `/finance`, `/finance/add`, `/finance/report`, `/finance/settings`, `/finance/challenges` plus `/modules/finance` redirect using Quill kit, keypad, SVG pie, disclaimer, and inherited `--qx-font-size`; verify `npm test` and `npm run check`

## 5. Integration verification

- [x] 5.1 Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test` in `api/` and verify they pass
- [x] 5.2 Run `npm run lint`, `npm run check`, `npm test`, and `npm run build` in `web/` and verify they pass
- [x] 5.3 Run `openspec validate --strict` and verify the change is valid

## Workflow follow-up

- Archive the change after implementation verification.
- Open a PR whose body includes `Refs #7`. Do not merge.
