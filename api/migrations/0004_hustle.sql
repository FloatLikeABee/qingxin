-- M10 job search + side hustle. SQLite-first, Postgres-ready.

CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    status TEXT NOT NULL,
    interview_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX applications_user_updated ON applications (user_id, updated_at);

CREATE TABLE resumes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title TEXT,
    content_json TEXT NOT NULL,
    pdf_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX resumes_user_version ON resumes (user_id, version);

CREATE TABLE side_hustles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    estimated_income INTEGER NOT NULL,
    skills_required TEXT NOT NULL,
    kind TEXT NOT NULL,
    hours_per_week INTEGER,
    created_at TEXT NOT NULL
);

CREATE INDEX side_hustles_user_kind ON side_hustles (user_id, kind);
