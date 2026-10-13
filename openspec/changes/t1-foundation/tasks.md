# Tasks

## 1. Contract, crate, and health

- [ ] 1.1 Confirm `api/openapi.yaml` is on the branch and describes `/health`, auth, privacy, devices, jobs, and `/v1/ai/complete`
- [ ] 1.2 Write a failing `GET /health` integration test against an Axum router
- [ ] 1.3 Scaffold `api/` (Cargo.toml, lib/main, config, error, SQLite pool + migrations) and make `/health` pass
- [ ] 1.4 Add `.gitignore` for `api/target` and local sqlite files

## 2. Encryption and auth

- [ ] 2.1 Write failing unit tests for AES-GCM round-trip and HMAC lookup; implement `crypto` to pass
- [ ] 2.2 Write failing tests for register, duplicate email, login success/failure, and unauthenticated `/v1/me`
- [ ] 2.3 Implement email/password, Argon2, JWT access, and hashed refresh issuance so those tests pass
- [ ] 2.4 Write failing tests for refresh rotation and reuse-family revoke; implement rotation to pass
- [ ] 2.5 Write failing tests for SMS stub request/verify; implement the stub sender and OTP table to pass

## 3. Privacy, seams, devices, jobs

- [ ] 3.1 Write failing tests for consent, export JSON, and account delete; implement privacy routes to pass
- [ ] 3.2 Write failing tests for `NoopModerator` and injectable `AiGateway` (501 default, 200 when injected); implement traits and routes to pass
- [ ] 3.3 Write failing tests for caregiver invite/accept and device issue/revoke/Device-auth; implement to pass
- [ ] 3.4 Write failing tests for job create and scheduler delivery through a recording `PushSender`; implement jobs, subscriptions, and ticker to pass

## 4. CI and verification

- [ ] 4.1 Add `.github/workflows/qingxin.yml` path-filtered for `api/**` and `web/**` with cargo fmt, clippy `-D warnings`, cargo test, and SvelteKit check/test/build
- [ ] 4.2 Run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` in `api/` and fix until they pass
- [ ] 4.3 Update the root README to point at `api/` and the OpenAPI file
