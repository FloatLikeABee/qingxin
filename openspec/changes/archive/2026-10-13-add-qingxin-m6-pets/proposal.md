# Proposal

## Why

Issue #17 (M6 宠物生活管理) needs a digital pet health record — vaccines, deworming, weight, vet visits, daily care check-ins, and due reminders — after T1, T2, M2, and M3 landed. The uploaded draft targeted main at `b5268c1`; this change maps it onto the live `api/` + `web/` tree and locks PO defaults for nearby services, avatars, reminder lead time, and owner-only pets.

## What Changes

- Additive SQLx migration `api/migrations/0006_pets.sql` for `pet_pets`, `pet_health_records`, `pet_weights`, `pet_daily_logs`, and `pet_reminders`.
- Axum pets module at `/v1/pets/*` behind T1 `AuthUser`. Cross-user ids return 404; missing tokens return 401 `unauthenticated`.
- Health-record notes stored with T1 `FieldCrypto` (`note_encrypted`). Dates and types stay plaintext so the calendar can query them.
- Due-date reminders enqueue `scheduled_jobs` kind `pet.due` at 09:00 local the day before `next_due_date`. Daily care reminders reuse `elder::schedule` time-plus-weekday helpers and enqueue kind `pet.care`.
- Scheduler tick delivers those jobs through `PushSender`. Care jobs re-enqueue the next occurrence after a successful send.
- Nearby services is a placeholder link to the M4 local-life route (`/modules/local?category=pet`). No M4 code or map SDK.
- Avatars are an optional `avatar_url` text field. No file or blob storage.
- Pets are owner-only in v1. No family-shared pets or caregiver access.
- Every health API payload and health web view includes a persistent 非兽医建议 notice.
- AI care-tip route is an `AiGateway` stub (`ai_unconfigured` until Echo is configured).
- SvelteKit pages under `web/src/routes/pets/` using Quill kit tokens only so global `html.elder` applies.
- Extend `api/openapi.yaml` with the Pets contract and `ExportPayload.pets`.

## Capabilities

### New Capabilities

- `qingxin-pets`: owner-scoped pet profiles, health records with due reminders, gram weights, daily care check-ins, care reminders, nearby-services placeholder, and pet privacy hooks.

### Modified Capabilities

- `privacy`: JSON export MUST include the caller's pets (notes decrypted); account deletion MUST leave no `pet_*` rows.
- `field-encryption`: pet health-record notes MUST be AES-256-GCM at rest.

## Impact

- New: `api/src/pets/`, `api/tests/pets.rs`, `api/migrations/0006_pets.sql`, `web/src/lib/pets/`, `web/src/routes/pets/`, `web/src/routes/modules/pet/` redirect.
- Shared hunks only: `api/src/lib.rs` (`pub mod pets`), `api/src/routes.rs` (router merge + export hook), `api/src/scheduler.rs` (after-job hook), `api/openapi.yaml` (Pets tag/paths/schemas + export field), `web/src/routes/modules/[slug]/+page.svelte` (open-pets button).
- Contract: `api/openapi.yaml` Pets tag and `ExportPayload.pets`.
- CI: existing `.github/workflows/qingxin.yml` (`api/**`, `web/**`).
- Parallel M7: keep shared-file hunks additive and tiny. No new crates, keys, or network calls in CI.
