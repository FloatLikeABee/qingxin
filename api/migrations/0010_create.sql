-- M9 content studio. SQLite-first, Postgres-ready.

CREATE TABLE creations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    title TEXT,
    prompt_params TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    final_content TEXT NOT NULL,
    versions_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX creations_user_updated ON creations (user_id, updated_at);

CREATE TABLE snippets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    kind TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX snippets_user_updated ON snippets (user_id, updated_at);
