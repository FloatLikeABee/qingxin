-- M8 study check-in. SQLite-first, Postgres-ready.
-- Flashcard faces and note Markdown are AES-256-GCM. Titles, tags, dates stay plaintext.

CREATE TABLE study_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_days INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    timezone TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX study_challenges_user ON study_challenges (user_id, created_at);

CREATE TABLE study_checkins (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES study_challenges (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (challenge_id, day)
);

CREATE INDEX study_checkins_user_day ON study_checkins (user_id, day);

CREATE TABLE study_flashcards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    front_encrypted BLOB NOT NULL,
    back_encrypted BLOB NOT NULL,
    category TEXT,
    ease REAL NOT NULL,
    interval_days INTEGER NOT NULL,
    next_review_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX study_flashcards_user_due ON study_flashcards (user_id, next_review_date);

CREATE TABLE study_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_md_encrypted BLOB,
    tags TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX study_notes_user ON study_notes (user_id, updated_at);

CREATE TABLE study_skill_nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES study_skill_nodes (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    unlocked INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX study_skills_user ON study_skill_nodes (user_id, sort_order);

CREATE TABLE study_reminders (
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

CREATE INDEX study_reminders_user ON study_reminders (user_id, kind, time_local);
