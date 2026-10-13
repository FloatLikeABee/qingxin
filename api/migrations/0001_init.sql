-- SQLite-first, Postgres-ready:
-- TEXT UUIDs, TEXT RFC3339 timestamps written from Rust, INTEGER flags.
-- No AUTOINCREMENT, no datetime('now'), no SQLite-only column types.

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    phone_encrypted BLOB,
    phone_lookup TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX users_email_unique
    ON users (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX users_phone_lookup_unique
    ON users (phone_lookup)
    WHERE phone_lookup IS NOT NULL;

CREATE TABLE privacy_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    policy_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL
);

CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    family_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX refresh_tokens_family ON refresh_tokens (family_id);

CREATE TABLE sms_otps (
    id TEXT PRIMARY KEY,
    phone_lookup TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE caregiver_invites (
    id TEXT PRIMARY KEY,
    dependent_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE caregiver_links (
    id TEXT PRIMARY KEY,
    caregiver_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    dependent_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (caregiver_user_id, dependent_user_id)
);

CREATE TABLE device_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    issued_by_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT,
    last_used_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, endpoint)
);

CREATE TABLE scheduled_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    run_at TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX scheduled_jobs_due ON scheduled_jobs (status, run_at);
