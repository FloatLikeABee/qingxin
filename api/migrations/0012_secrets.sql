-- Private mailbox letters. Bodies are AES-256-GCM blobs.

CREATE TABLE secret_letters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pair_id TEXT NOT NULL,
    role TEXT NOT NULL,
    title TEXT NOT NULL,
    body_encrypted BLOB NOT NULL,
    consented_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX secret_letters_user_created ON secret_letters (user_id, created_at);
CREATE INDEX secret_letters_pair ON secret_letters (user_id, pair_id);
