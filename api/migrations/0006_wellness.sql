-- M7 light wellness. SQLite-first, Postgres-ready.
-- Sensitive free text is AES-256-GCM. Dates, ml and quality stay plaintext.

CREATE TABLE well_goals (
    user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    water_ml_target INTEGER NOT NULL,
    cycle_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE well_water_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    logged_on TEXT NOT NULL,
    ml INTEGER NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE INDEX well_water_user_day ON well_water_logs (user_id, logged_on);

CREATE TABLE well_sleep_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sleep_at TEXT NOT NULL,
    wake_at TEXT NOT NULL,
    quality INTEGER NOT NULL,
    note_encrypted BLOB,
    created_at TEXT NOT NULL
);

CREATE INDEX well_sleep_user ON well_sleep_logs (user_id, sleep_at);

CREATE TABLE well_cycles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    flow_level TEXT,
    symptoms_encrypted BLOB,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX well_cycles_user ON well_cycles (user_id, start_date);

CREATE TABLE well_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    report_date TEXT NOT NULL,
    title TEXT NOT NULL,
    metrics_encrypted BLOB,
    source TEXT NOT NULL,
    confirmed INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX well_reports_user ON well_reports (user_id, report_date);

CREATE TABLE well_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    target_days INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE well_plan_checkins (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES well_plans (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (plan_id, day)
);

CREATE TABLE well_reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    time_local TEXT NOT NULL,
    days_of_week TEXT NOT NULL,
    timezone TEXT NOT NULL,
    active INTEGER NOT NULL,
    reminder_job_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX well_reminders_user ON well_reminders (user_id, kind, time_local);
