# Design

## Context

T2 already shipped `web/` and `.github/workflows/web.yml`. There is no `api/` crate. PLAN.md still says `qingxin/server` because it assumed a monorepo prefix (`FloatLikeABee/robo`); the live repo is `FloatLikeABee/qingxin` with apps at the root. Issue #4, the user brief, and the existing `web/` layout all say `api/`.

Notion T1 acceptance criteria also list a full AI gateway (DashScope/Zhipu/Kimi/Ollama, SSE, cache). Echo owns that on issue #3. This change ships the seam only.

Superpowers self-grill (required): proposer and skeptical reviewer, at least three alternatives per decision, failure modes checked against the actual tree.

## Goals / Non-Goals

**Goals:**

- One Axum binary that other modules can call over the published OpenAPI.
- Auth, encryption, privacy, jobs/push, and caregiver devices are testable without network vendors.
- AI and moderation are traits on `AppState` so later crates inject implementations.
- CI fails on rustfmt, clippy `-D warnings`, and `cargo test` for `api/`, and still builds the frontend.

**Non-Goals:**

- Implementing Echo's model gateway, provider fallback, semantic cache, or SSE.
- Real SMS/carrier or Aliyun/Tencent content-security HTTP calls.
- Module domain tables (mood logs, ledgers, pets, …).
- Switching the SvelteKit mock client to HTTP (Quill/T2 follow-up).
- Merging the PR (PO merges).

**Anti-goals:**

- Shipping a gateway that races Echo and forks the `ai` module.
- Storing phone numbers in plaintext "until later".
- Irrevocable long-lived JWTs for stolen elder tablets.

## Decisions

### D1 — Crate path and layout

**Chosen:** Single crate `qingxin-api` at `api/`, library + binary, runtime SQLx queries (no compile-time `query!` macros).

**Assumptions challenged against the tree:** PLAN.md `qingxin/server` is stale. `web/` is already at the repo root. A nested `qingxin/` prefix would split CI path filters and contradict issue #4.

**Rejected:**

1. **`qingxin/server` as in PLAN.md** — would orphan `web/` and break the issue contract (`api/`).
2. **Workspace of `qingxin-core` + `qingxin-ai` crates** — Echo's gateway is a follow-up PR; extra crates add CI surface without a second owner in this change.
3. **Actix-web / Warp** — issue and PLAN mandate Axum.

### D2 — Auth tokens

**Chosen:** JWT access (15m, `typ=access`) plus opaque refresh tokens stored as SHA-256 hashes with a `family_id`. Rotation issues a new refresh and revokes the old one. Presenting a revoked or unknown token of a reused family revokes the whole family.

**Rejected:**

1. **Redis / server sessions only** — no Redis in T1; ephemeral disk would drop sessions on every Render restart even sooner than SQLite files.
2. **Access JWT only (no refresh)** — violates the issue; PWAs need silent renew.
3. **Refresh-as-JWT with no server store** — cannot rotate or revoke a stolen refresh without a denylist, which is a store by another name.

### D3 — Phone encryption

**Chosen:** AES-256-GCM. Column `phone_encrypted` is `nonce || ciphertext`. `phone_lookup` is HMAC-SHA256 of the normalized E.164 value with `QINGXIN_LOOKUP_KEY`. Process refuses to boot if data or lookup keys are missing or the wrong length. Export decrypts the caller's own phone.

**Rejected:**

1. **SQLCipher** — encrypts the whole file and is not how we will run Postgres later.
2. **pgcrypto / DB-side AES** — not portable to SQLite tests.
3. **Plaintext phone plus "encrypt in T13"** — spec 1.5 and the T1 card require AES-GCM now.

### D4 — AI seam (do not build the gateway)

**Chosen:** `AiGateway` async trait (`complete`) on `AppState`. Default `UnconfiguredAiGateway` yields `AiError::Unconfigured`. `POST /v1/ai/complete` maps that to HTTP 501 `ai_unconfigured`. No provider HTTP clients, no SSE, no token ledger.

**Rejected:**

1. **Implement the full OpenAI-compatible gateway in this PR** — duplicates Echo (issue #3) and the user brief forbids it.
2. **Empty `ai` module with no types** — Echo would invent the request/response shape; the OpenAPI seam would be useless.
3. **Side-car localhost client** — couples boot order and fails CI without Echo's process.

### D5 — Moderation

**Chosen:** `Moderator` async trait + `NoopModerator` that returns `Decision::Allow`. Held on `AppState` for M1/M5 UGC later. No public HTTP route in T1 (avoids advertising a fake safety filter).

**Rejected:**

1. **Aliyun/Tencent HTTP now** — credentials, vendor lock, and out of T1 scope.
2. **Public `/v1/moderation/check` that always allows** — looks like a real safety control to clients.
3. **Hard-coded keyword blocklist** — false sense of compliance; still not a vendor.

### D6 — Scheduler and Web Push

**Chosen:** `scheduled_jobs` table + tokio interval ticker. Claim is `UPDATE … SET status='running' WHERE id=? AND status='pending'` to avoid double send. `PushSender` trait; tests use a recording sender. A `WebPushSender` implements RFC 8030-style HTTP when VAPID keys exist; when they do not, the sender logs and records the attempt so CI does not need OpenSSL.

**Rejected:**

1. **In-memory `tokio-cron-scheduler` only** — jobs die on restart (Render/ephemeral).
2. **Separate worker binary** — "one application per service"; T1 is a single API process.
3. **FCM-only** — the product is a PWA; standard Web Push + VAPID matches T2's service worker.

### D7 — Caregiver device sessions

**Chosen:** Dependent creates a one-time invite code; caregiver accepts → `caregiver_links` row. Either the user or a linked caregiver can `POST /v1/devices` for that `user_id`. Device credential is opaque, hashed, default TTL 365 days, sent as `Authorization: Device <token>`. Revocable.

**Rejected:**

1. **Long-lived JWT with no row** — stolen living-room tablet cannot be revoked.
2. **Caregiver POSTs any `user_id` without a link** — account takeover.
3. **Share the elder's password onto the tablet** — contradicts "子女远程配置，老人极简使用".

### D8 — Database dialect

**Chosen:** SQLite for local/CI. Migrations use TEXT UUID primary keys, TEXT ISO-8601 timestamps written from Rust, INTEGER 0/1 flags, and `ON CONFLICT` upserts. Foreign keys on. WAL enabled in the SQLite connect path only. Handlers never call `datetime('now')` or `AUTOINCREMENT`.

**Rejected:**

1. **Postgres-only from day one** — CI and laptops need a file DB; the card says SQLite-first.
2. **SQLx compile-time macros against a checked-in `qingxin.db`** — painful for Cloud Agent/CI without `sqlx prepare`.
3. **Diesel** — stack is SQLx.

### D9 — CI

**Chosen:** `.github/workflows/qingxin.yml` path-filtered on `api/**`, `web/**`, and the workflow file. Two jobs: `api` (fmt, clippy `-D warnings`, test) and `web` (npm ci, check, test, build). Keep existing `web.yml` so T2 PRs that only knew that file still run.

**Rejected:**

1. **Replace `web.yml` in this PR** — unrelated breakage for Quill.
2. **PLAN's `qingxin/**` path filter** — nothing lives under `qingxin/`.
3. **A single job that builds Rust and Node** — slower and conflates caches.

### D10 — Bind and config

**Chosen:** Listen on `0.0.0.0:$PORT` (Render). Config from env: `DATABASE_URL`, `JWT_SECRET`, `QINGXIN_DATA_KEY`, `QINGXIN_LOOKUP_KEY`, `QINGXIN_SMS_STUB`, VAPID keys. Tests inject `Config` in process and never read the process environment for secrets.

## Design review (self-grill)

**Proposer:** Ship a complete but thin foundation: real crypto and token rotation, vendor I/O behind traits, OpenAPI first.

**Reviewer pushback:**

1. *You will over-build caregiver invites when M3 might want WeChat bind.* — Invite codes are the minimum link that does not let strangers attach to an account. WeChat is out of T1. If M3 adds another bind, `caregiver_links` stays.
2. *SQLite on Render's ephemeral disk loses data.* — True. Document it; schema stays portable. T1 acceptance is SQLite-first, not multi-tenant prod HA.
3. *A 501 AI route is a fake product surface.* — Better than Echo inventing a path. The OpenAPI file is already the stub target.
4. *No-op moderation is dangerous if M1 writes UGC through it and thinks it is filtered.* — Do not expose an HTTP "safe" endpoint. Name the type `NoopModerator`. Tests assert it always allows so the lie is visible.
5. *Refresh-family revoke might lock out a user who double-clicks refresh.* — Acceptable; the client should treat 401 on refresh as login. Concurrent refresh is a known SPA bug; document single-flight on the client later.
6. *Device scheme `Authorization: Device` is non-standard.* — Prevents JWT parsers from rejecting opaque tokens. Alternative `Bearer` plus probe-JWT-then-hash is easy to mis-order; we still accept that fallback in the extractor so a naive client can send Bearer.

**Revisions after grilling:**

- Path is `api/`, not `qingxin/server`.
- AI gateway implementation removed from this change's tasks.
- Moderation has no public route.
- Device auth documents `Device` first, Bearer fallback second.
- Scheduler claim is compare-and-set, not "select then update".
- Boot fails closed without encryption keys.

## Risks / Trade-offs

- **[Risk] Refresh reuse detection after a race** → Mitigation: one refresh in flight; family revoke is the safe failure.
- **[Risk] SMS stub `dev_code` leaks in production** → Mitigation: field only when `QINGXIN_SMS_STUB=1`; default off.
- **[Risk] Job double-fire on overlapping ticks** → Mitigation: pending→running claim; `max_connections` + WAL.
- **[Risk] Echo's trait diverges from `AiGateway`** → Mitigation: keep the trait tiny (`complete` + shared message types); they own providers.
- **[Risk] Frontend mock password min-length is 6, API is 8** → Mitigation: OpenAPI is source of truth; T2 mock can tighten later.
- **[Risk] Duplicate CI with `web.yml` + `qingxin.yml`** → Mitigation: extra minutes, not extra product risk.

## Migration Plan

1. OpenAPI is already on the branch.
2. Land `api/`, migrations, and `qingxin.yml`.
3. Echo implements `AiGateway` and replaces `UnconfiguredAiGateway` in `main`.
4. Quill adds `HttpQingxinApi` from this OpenAPI.
5. Rollback: revert the branch; no prod data yet.

## Open Questions

None that block T1. Family/WeChat bind and real SMS vendors wait for later modules.
