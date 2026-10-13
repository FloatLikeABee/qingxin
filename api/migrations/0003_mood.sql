-- M1 mood journal + meditation. SQLite-first, Postgres-ready.

CREATE TABLE mood_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    score INTEGER NOT NULL,
    tags_json TEXT NOT NULL,
    note_encrypted BLOB,
    created_at TEXT NOT NULL
);

CREATE INDEX mood_logs_user_created ON mood_logs (user_id, created_at);

CREATE TABLE meditation_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT
);

CREATE INDEX meditation_sessions_user_started ON meditation_sessions (user_id, started_at);
