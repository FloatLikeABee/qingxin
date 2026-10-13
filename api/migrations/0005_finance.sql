-- M2 personal finance. SQLite-first, Postgres-ready.
-- Amounts are integer fen. Notes are AES-256-GCM blobs. Dates are YYYY-MM-DD.

CREATE TABLE fin_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX fin_categories_user ON fin_categories (user_id, kind, sort_order);

CREATE TABLE fin_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount_fen INTEGER NOT NULL,
    type TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES fin_categories (id),
    note_encrypted BLOB,
    occurred_on TEXT NOT NULL,
    client_id TEXT NOT NULL,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX fin_transactions_client ON fin_transactions (user_id, client_id);
CREATE INDEX fin_transactions_user_day ON fin_transactions (user_id, occurred_on, id);

CREATE TABLE fin_budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id TEXT REFERENCES fin_categories (id),
    monthly_limit_fen INTEGER NOT NULL,
    alert_threshold_pct INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX fin_budgets_user_cat
    ON fin_budgets (user_id, COALESCE(category_id, ''));

CREATE TABLE fin_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_fen INTEGER NOT NULL,
    cycle TEXT NOT NULL,
    next_billing_date TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL,
    active INTEGER NOT NULL,
    reminder_job_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX fin_subscriptions_user ON fin_subscriptions (user_id, active, next_billing_date);

CREATE TABLE fin_savings_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_days INTEGER NOT NULL,
    target_amount_fen INTEGER,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE fin_challenge_checkins (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES fin_savings_challenges (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (challenge_id, day)
);

INSERT INTO fin_categories (id, user_id, name, kind, sort_order, created_at) VALUES
    ('fin-cat-exp-food', NULL, '餐饮', 'expense', 1, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-transit', NULL, '交通', 'expense', 2, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-shop', NULL, '购物', 'expense', 3, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-home', NULL, '居住', 'expense', 4, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-fun', NULL, '娱乐', 'expense', 5, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-med', NULL, '医疗', 'expense', 6, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-study', NULL, '学习', 'expense', 7, '2026-10-13T00:00:00Z'),
    ('fin-cat-exp-other', NULL, '其他', 'expense', 8, '2026-10-13T00:00:00Z'),
    ('fin-cat-inc-salary', NULL, '工资', 'income', 1, '2026-10-13T00:00:00Z'),
    ('fin-cat-inc-part', NULL, '兼职', 'income', 2, '2026-10-13T00:00:00Z'),
    ('fin-cat-inc-yield', NULL, '理财收益', 'income', 3, '2026-10-13T00:00:00Z'),
    ('fin-cat-inc-other', NULL, '其他', 'income', 4, '2026-10-13T00:00:00Z');
