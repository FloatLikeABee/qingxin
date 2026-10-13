-- M6 pet life. SQLite-first, Postgres-ready.
-- Weights are integer grams. Vet notes are AES-256-GCM blobs. Dates are YYYY-MM-DD.

CREATE TABLE pet_pets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    birthday TEXT,
    avatar_url TEXT,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX pet_pets_user ON pet_pets (user_id, sort_order, created_at);

CREATE TABLE pet_health_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pet_pets (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    next_due_date TEXT,
    note_encrypted BLOB,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX pet_health_records_user ON pet_health_records (user_id, date, id);
CREATE INDEX pet_health_records_pet ON pet_health_records (pet_id, date, id);

CREATE TABLE pet_weights (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pet_pets (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    measured_on TEXT NOT NULL,
    weight_g INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX pet_weights_pet ON pet_weights (pet_id, measured_on, id);

CREATE TABLE pet_daily_logs (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pet_pets (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value TEXT,
    logged_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX pet_daily_logs_pet_day ON pet_daily_logs (user_id, pet_id, logged_at, type);

CREATE TABLE pet_reminders (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pet_pets (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    time_local TEXT NOT NULL,
    days_of_week TEXT NOT NULL,
    timezone TEXT NOT NULL,
    active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX pet_reminders_user ON pet_reminders (user_id, active);
