# Design

## Context

See proposal.md — Why. Live tree is FloatLikeABee/qingxin main at `b5268c1` (M2 #14 and M3 #11 merged). Module layout is `api/src/<module>/mod.rs` exposing `pub fn router() -> Router<AppState>`, merged in `api/src/routes.rs`. Auth is `AuthUser`; strangers get `AppError::NotFound` (404), never 403. Encryption is `FieldCrypto` (`*_encrypted BLOB`). Reminders drain through `scheduled_jobs` + `scheduler::tick_once` + `PushSender`. Time-plus-weekday helpers already live in `api/src/elder/schedule.rs` and `web/src/lib/elder/schedule.ts`. Web pages must use Quill kit tokens so global `html.elder` applies. Latest migration on main is `0005_finance.sql`; next free number is `0006`. M7 is landing in parallel — shared hunks stay tiny.

Superpowers self-grill (required): proposer vs skeptical reviewer, at least three alternatives per major decision, checked against the live tree. PO defaults from issue #17 resolve the draft `OPEN-QUESTIONS.md`.

## Goals / Non-Goals

**Goals:**

- Owner-scoped pet CRUD, health records, gram weights, daily logs, and today summary.
- Due reminders at 09:00 local the day before `next_due_date`; care reminders as HH:MM + ISO weekdays.
- Encrypted vet notes; 非兽医建议 on every health surface.
- Nearby services as a link to `/modules/local?category=pet`.
- Kit-token UI under `/pets` plus `/modules/pet` redirect.

**Non-Goals:**

- Family-shared pets, caregiver access, or a second auth path.
- File/blob avatar storage or image CDN.
- An embedded map or any M4 handler.
- Veterinary diagnosis, dosage advice, or guaranteed on-time alerts.
- New job kinds on the public `POST /v1/jobs` validator (that stays `web_push` only).
- Restyling Quill primitives; pages inherit `html.elder`.
- Merging the PR (PO merges).

## Decisions

### D1 — Due-reminder delivery

**Chosen:** Enqueue one `scheduled_jobs` row per health record that has `next_due_date` (kind `pet.due`, payload `type=pet.due`, `run_at` = due-minus-1-day at 09:00 in the owner's timezone, default `Asia/Shanghai`). On edit/delete, cancel or replace the pending job. `tick_once` already sends every pending job through `PushSender`.

**Rejected:**

1. **Daily scanner that queries all due records** — a second scheduling path beside T1; harder to test and easy to double-fire.
2. **Client-only local notifications** — iOS/PWA permission is unreliable; PO requires Web Push via T1.
3. **Calendar (.ics) export only** — no in-product reminder, fails the issue scope.
4. **Reuse `POST /v1/jobs` from the client** — that validator only allows `web_push` and would force the web app to compute `run_at`.

**Grill:** *Custom kind `pet.due` vs M2/M3 `web_push`.* The public jobs API stays untouched; M3 already inserts rows itself. Kind is how tests and cancel-by-kind find pet jobs without `LIKE` collisions against finance. Payload still carries `type` so `after_job` can ignore foreign jobs. *09:00 is arbitrary.* Locked by PO. *Past due dates.* Still enqueue; the next tick delivers immediately, matching M2 subscription behaviour.

### D2 — Weight storage

**Chosen:** Separate `pet_weights` rows with integer `weight_g` and `measured_on` (`YYYY-MM-DD`).

**Rejected:**

1. **REAL kilograms on `pet_pets`** — float drift; one current value cannot chart history.
2. **JSON array on the pet row** — cannot index, owner-filter, or export cleanly.
3. **Fen-style decimal string** — extra parse path; grams are already the integer unit owners use on clinic scales.

**Grill:** *Why not grams on the health-record table?* Records are vaccine/deworm/checkup/vet_visit events; mixing them with a daily scale reading breaks the calendar type filter. Same integer-not-float reasoning as M2 fen.

### D3 — Ownership and 404-vs-403

**Chosen:** Denormalise `user_id` on every child row. Every handler takes `AuthUser` and filters `WHERE user_id = ?`. Cross-owner and caregiver access return 404. No token returns 401.

**Rejected:**

1. **Join through `pet_pets` on every child query** — extra round-trip and a leak if a join is forgotten.
2. **SQLite RLS / triggers** — SQLite has no RLS; app-level AuthUser is the T1 contract.
3. **403 for strangers** — confirms the id exists; M2/M3 forbid this.
4. **Reuse M3 caregiver_links** — PO: no family-shared pets in v1.

**Grill:** *Caregiver already exists for elders.* Sharing a pet is a different consent story (vet notes, weight). v1 stays owner-only so we do not invent a second grant table. Tests include a linked caregiver 404.

### D4 — Nearby services

**Chosen:** Placeholder page that links to `/modules/local?category=pet`. No map SDK, no service table, no import of M4 code.

**Rejected:**

1. **Embed a pet-hospital list in M6** — duplicates Quill's M4 ownership.
2. **Third-party map SDK** — new key, new CI network, out of file budget.
3. **Wait and ship no services UI** — the product spec has a 社区/附近 page; a link-out keeps the nav slot honest.

**Grill:** *M4 may not exist yet.* `/modules/local` already shows the T2 placeholder. Query string is documentation for Quill, not a runtime dependency.

### D5 — Sensitive notes

**Chosen:** Encrypt free-text `note` with `FieldCrypto` into `note_encrypted`. Type, `date`, and `next_due_date` stay plaintext.

**Rejected:**

1. **Plaintext notes** — vet notes can include owner address, clinic, and drug names.
2. **Encrypt the whole record** — calendar and due-job queries need type/date.
3. **Encrypt name/species too** — blocks list/search and is not in the issue.

**Grill:** *Same helper as finance `encrypt_note`.* Pets copies the small encrypt/decrypt helpers into `pets/mod.rs` rather than exporting finance internals (keeps the shared-file surface zero).

### D6 — Avatars

**Chosen:** Optional `avatar_url` text field only.

**Rejected:**

1. **Netlify Blobs / local uploads** — no blob store on main; filesystem is ephemeral.
2. **Base64 in SQLite** — blows up exports and backups.
3. **Force a generated identicon** — extra UI without a product ask.

**Grill:** *Invalid URLs?* Accept any trimmed string up to 2048 chars; the `<img>` uses a kit fallback on error.

### D7 — Care-reminder schedule

**Chosen:** Reuse `elder::schedule::{parse_hhmm, validate_days, next_occurrence, tz_offset}` without moving them. After a successful `pet.care` push, `pets::after_job` inserts the next occurrence if the rule is still active.

**Rejected:**

1. **Copy-paste the helpers into `pets/schedule.rs`** — two parsers will drift.
2. **Move helpers to `api/src/util.rs` now** — touches elder tests and M7 merge risk; PO said reuse, no behaviour change.
3. **Cron strings** — M3 already rejected cron as unreadable.

**Grill:** *Calling elder from pets couples modules.* Acceptable: schedule.rs is already a pure helper with no elder tables. A later extract can move it without a schema change.

### D8 — File boundaries (M7 conflict)

**Chosen:** New files for almost everything. Shared hunks: `lib.rs` (`pub mod pets`), `routes.rs` (`.merge(pets::router())` + one export call), `scheduler.rs` (`pets::after_job` after elder's hook), OpenAPI append, modules placeholder button, `/modules/pet` redirect.

**Rejected:**

1. **Append handlers to `routes.rs`** — guaranteed M7 merge pain.
2. **New columns on `users` or `scheduled_jobs`** — T1 table, extra migration conflict.
3. **Change `POST /v1/jobs` to allow `pet.due`** — touches T1 tests and the jobs enum.

### D9 — AI

**Chosen:** `POST /v1/pets/ai/care-tip` calls `state.ai.complete` and maps `AiError::Unconfigured` to 501. Success text is returned with the 非兽医建议 disclaimer. Tests use `QingxinAiGateway::mock` and `UnconfiguredAiGateway`.

**Rejected:**

1. **Inline DashScope/Qwen** — races Echo and violates the seam.
2. **Skip any AI route** — then M6 has no proven hook.
3. **Generate care plans on every today read** — hidden cost and unsolicited advice.

### D10 — Web information architecture

**Chosen:** `/pets` home (pet tabs, today todos, check-in buttons), `/pets/[id]` archive (weight chart + records), `/pets/calendar` month view, `/pets/services` link-out, `/modules/pet` 302 to `/pets`. Memory store + kit components. Disclaimer component on every health view.

**Rejected:**

1. **Keep everything under `/modules/pet`** — M2/M3 already escaped the placeholder for real modules.
2. **One giant page with drawers only** — calendar + archive need shareable URLs.
3. **Per-page font sizes** — would break `html.elder`.

## Design review (self-grill)

**Proposer:** Thin domain on T1 seams. Integer grams. Owner-only. Link-out for M4. Kit tokens only.

**Reviewer pushback:**

1. *Kind `pet.due` is not `web_push`.* — Public validator stays `web_push`. Internal inserts already use the table as a queue; the ticker does not filter on kind.
2. *Reusing elder schedule couples M3 and M6.* — Better than a second parser. Extract later if a third module needs it.
3. *09:00 day-before will miss same-day clinic bookings.* — PO locked lead time; users can still see the calendar.
4. *Caregiver 404 will surprise families who share a login.* — Shared login is already one owner; true multi-user sharing is later.
5. *Placeholder nearby page looks unfinished.* — Honest: Quill owns M4. An empty map would pretend otherwise.
6. *`after_job` in `scheduler.rs` is still a shared edit.* — A few lines vs forking the ticker.

**Revisions after grilling:**

- Locked PO defaults (nearby link, URL avatars, day-before 09:00, no shared pets, `0006_pets.sql`, encrypted notes, 非兽医建议 everywhere).
- Caregiver isolation test added so M3 links cannot read pets.
- Helpers stay in `elder::schedule`; no util move.
- Shared files limited to wiring.

## Risks / Trade-offs

- **[Risk] Migration number collision with M7** → `0006` is the next free number on main at apply time; file is additive `pet_*` only.
- **[Risk] OpenAPI merge conflicts** → append-only Pets tag/paths/schemas; rebase onto latest main before the PR.
- **[Risk] AuthZ bugs leak another household's vet notes** → `user_id` on every row; tests for stranger 404, caregiver 404, 401.
- **[Risk] PWA reminders silently fail** → Disclaimer on health views; jobs still land in `scheduled_jobs` for later retry.
- **[Risk] Fixed-offset tz map is not DST-aware** → Product is CN-first (`Asia/Shanghai` has no DST), same as M3.
- **[Risk] Custom job kinds confuse operators** → Payload `type` plus kind; `GET /v1/jobs` still lists the owner's rows.

## Migration Plan

1. Additive `0006_pets.sql`. Down is drop those tables (dev only).
2. Ship `/v1/pets/*` and `/pets` pages.
3. Rollback: revert the PR; T1/M2/M3 tables unchanged.
4. Account delete: `ON DELETE CASCADE` from `users` clears `pet_*` rows.

## Open Questions

None that block M6. Family-shared pets, avatar uploads, configurable lead time, and the real M4 map wait for later modules.
