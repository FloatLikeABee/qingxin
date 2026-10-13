# Proposal

## Why

Issue #8 (M3 家庭老人数字助手) needs children to configure an elder account remotely and elders to use a few large buttons, while T1 already ships caregiver invites, device sessions, the scheduler, and an AI seam. The draft assumed `qingxin/server` and `qingxin/web`; this repo roots those apps at `api/` and `web/`.

## What Changes

- Add M3 tables and `/v1/elder/*` routes in `api/`, documented in `api/openapi.yaml`.
- Reuse T1 caregiver invites, `caregiver_links`, and `Authorization: Device` for elder login. Do not add a second auth or invite path.
- Medication reminders use a clock time plus weekdays (not cron), delivered in-app and via T1 Web Push jobs, with a visible “not alarm-reliable” disclaimer.
- A missed dose creates an in-app caregiver notice and a T1 SMS-stub record.
- Activity log is written always and readable by caregivers only after the elder opts in.
- Seed a small admin-editable fraud-script set; each item cites a public 国家反诈中心 (or official republication) source.
- Add a global 适老 mode (large type, higher-contrast tokens) on T2 settings. Do not restyle the whole kit and do not force light on `/elder` only.
- Any generated-text path calls the existing `AiGateway` seam and stays stubbed until Echo lands.
- Add Svelte pages under `web/src/routes/elder/` plus minimal shared wiring (router merge, scheduler hook, settings toggle, CSS tokens).

## Capabilities

### New Capabilities

- `elder-assistant`: Family-managed elder home — reminders, contacts, tutorials, anti-fraud library, opt-in activity, missed-dose notices — authorized through T1 caregiver links and device sessions.

### Modified Capabilities

- `theming`: Add a global elder-mode preference that applies large type and high-contrast tokens without replacing the existing four theme modes.

## Impact

- New `api/src/elder/` module, `api/migrations/0002_elder.sql`, `api/tests/elder.rs`, and OpenAPI Elder paths/schemas.
- Small edits: `api/src/lib.rs`, `api/src/routes.rs` (nest router), `api/src/scheduler.rs` (post-job hook), `api/openapi.yaml`.
- New `web/src/routes/elder/**` and `web/src/lib/elder/**`; small edits to settings, `layout.css`, theme boot, and the elder module placeholder.
- M2 finance is landing in parallel — keep shared-file hunks tiny.
- Depends on merged T1 (#5) and T2 (#2). Does not implement Echo’s gateway (PR #6).
