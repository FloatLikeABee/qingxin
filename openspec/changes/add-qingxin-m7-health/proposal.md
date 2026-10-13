# Proposal

## Why

Issue #18 (M7 健康与轻养生) needs a non-medical habit toolkit — water, sleep, period tracking, checkup metrics, and 21-day plans — after T1 (`api/`) and T2 (`web/`) plus M2 finance and M3 elder merged. Capability `health` already exists for `GET /health`, so this module is named `wellness`. The draft assumed `qingxin/server` and `qingxin/web`; this change maps it onto the live tree and locks PO answers (period consent off by default, metrics-only reports, caregivers never see wellness data, 2000 ml / 2 h / 08:00–22:00 water defaults, encrypted symptoms/sleep notes/report values, a fixed 非医疗建议 notice).

## What Changes

- Additive SQLx migration `api/migrations/0006_wellness.sql` for `well_goals`, `well_water_logs`, `well_sleep_logs`, `well_cycles`, `well_reports`, `well_plans`, `well_plan_checkins`, `well_reminders`. Renumber at apply/PR time if another module has taken 0006.
- Axum `api/src/wellness/` mounted at `/v1/wellness/*` behind T1 `AuthUser`. Cross-user ids return 404; missing tokens return 401 `unauthenticated`. Caregiver links MUST NOT grant wellness access.
- Period tracking requires an explicit `cycle_consent` toggle (off by default). Without consent the API MUST NOT store cycle rows.
- Cycle symptoms, sleep notes, and report metric JSON stored with T1 `FieldCrypto` AES-256-GCM (`*_encrypted` BLOB). Dates, ml, and sleep quality stay plaintext so rings and charts work.
- Water goal defaults to 2000 ml. Interval reminders (default every 2 hours 08:00–22:00) expand server-side into HH:MM + ISO weekday rules, then `scheduled_jobs` kind `web_push` with payload `type=wellness.water`, delivered by T1 `PushSender`.
- Average-based cycle prediction (mean of last ≤6 cycle lengths, default 28) labelled 仅供参考. Report OCR and plan-suggest go through `AiGateway` stubs; v1 stores metrics JSON only, not files.
- Privacy export includes decrypted wellness records for the owner; account delete cascades `well_*` rows. Cycle rows appear in export only when consent is on.
- SvelteKit routes under `web/src/routes/wellness/` using Quill kit components and inherited `--qx-font-size` / contrast tokens (global `html.elder` applies). Fixed 非医疗建议 copy on home, prediction, reports, and AI output.
- Extend `api/openapi.yaml` with the Wellness tag and `ExportPayload.wellness`.

## Capabilities

### New Capabilities

- `qingxin-wellness`: owner-scoped light wellness — water ring and reminders, sleep check-ins, consented period tracking with average prediction, metrics-only reports with OCR stub, 21-day plans, and wellness privacy hooks.

### Modified Capabilities

- `privacy`: JSON export MUST include the caller's wellness records (cycles only with consent); account deletion MUST leave no `well_*` rows.
- `field-encryption`: cycle symptoms, sleep notes, and report metric JSON MUST be AES-256-GCM at rest.

## Impact

- Code: new `api/src/wellness/` and `api/tests/wellness.rs`; small mounts in `api/src/lib.rs`, `api/src/routes.rs` (export hook + router merge), and `api/src/scheduler.rs` (reminder maintenance tick).
- Web: new `web/src/lib/wellness/` and `web/src/routes/wellness/`; `web/src/routes/modules/health/+page.ts` redirect only. No T2 tab or theme-token rewrite; do not restyle kit primitives.
- Contract: `api/openapi.yaml` Wellness tag and `ExportPayload.wellness`.
- CI: existing `.github/workflows/qingxin.yml` (`api/**`, `web/**`).
- Parallel M6 pets: keep shared-file hunks tiny; take the next free migration number at PR time.
