# Proposal

## Why

Qingxin has a SvelteKit shell (T2) and no backend. Module teams cannot persist users, consent, encrypted PII, reminders, or caregiver device sessions, and Echo cannot plug an AI gateway into a missing seam. Issue #4 requires the T1 foundation now so M1/M5 and M3 can stub against a published contract.

## What Changes

- Add a Rust Axum + SQLx API crate at `api/` (not `qingxin/server`: this repo already roots apps at `web/` / `api/`).
- SQLite-first migrations that stay Postgres-ready (TEXT ids/timestamps, no SQLite-only types).
- Email/password auth plus a phone-SMS stub; JWT access tokens and rotating hashed refresh tokens.
- AES-256-GCM for sensitive fields (phone) with HMAC lookup hashes.
- Privacy consent records, JSON export, and account deletion.
- `AiGateway` trait + `UnconfiguredAiGateway`; `POST /v1/ai/complete` returns `ai_unconfigured` (Echo builds the real gateway).
- `Moderator` trait + no-op stub that always allows.
- In-process job scheduler backed by a jobs table and a `PushSender` trait (Web Push).
- Long-lived, revocable device sessions a linked caregiver can issue.
- Publish `api/openapi.yaml` (already committed) and `.github/workflows/qingxin.yml` (path-filtered cargo fmt/clippy/test + SvelteKit check/test/build).
- `GET /health` for liveness and a database ping.

## Capabilities

### New Capabilities

- `health`: Process liveness and database readiness at `GET /health`.
- `auth`: Email/password and phone-SMS stub sign-in with JWT access and refresh rotation.
- `field-encryption`: AES-GCM at rest for sensitive fields with keyed lookup hashes.
- `privacy`: Consent records, JSON data export, and account erasure.
- `ai-seam`: In-process AI gateway trait and reserved HTTP completion route.
- `moderation`: Content-moderation trait with a no-op allow stub.
- `job-scheduler`: Persisted jobs, in-process ticker, and Web Push delivery seam.
- `device-sessions`: Caregiver invite/link and long-lived revocable device credentials.

### Modified Capabilities

- None. T2 `api-client` remains a frontend mock until a later swap to this OpenAPI.

## Impact

- New `api/` crate, migrations, and OpenAPI file.
- New `.github/workflows/qingxin.yml` (existing `web.yml` stays; T1 adds the combined path-filtered workflow required by the card).
- Environment secrets: JWT, data/lookup keys, optional VAPID, SMS stub flag.
- Echo's follow-up implements `AiGateway`; Bridge M3 consumes caregiver device sessions.
- Render/ephemeral-disk constraint: SQLite is for local/CI; production should point `DATABASE_URL` at Postgres later without rewriting handlers.
