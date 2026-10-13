-- M5 AI productivity toolbox. SQLite-first, Postgres-ready.

CREATE TABLE ai_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,
    input_kind TEXT NOT NULL,
    input_text TEXT NOT NULL,
    input_meta TEXT NOT NULL,
    output_text TEXT NOT NULL,
    output_json TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX ai_tasks_user_created ON ai_tasks (user_id, created_at);
CREATE INDEX ai_tasks_user_tool_created ON ai_tasks (user_id, tool_id, created_at);

CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    favourite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, tool_id)
);

CREATE INDEX templates_user_fav ON templates (user_id, favourite);
