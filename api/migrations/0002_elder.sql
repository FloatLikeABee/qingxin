-- M3 elder assistant. Additive, SQLite-first / Postgres-ready.

CREATE TABLE elder_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    activity_log_opt_in INTEGER NOT NULL DEFAULT 0,
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE elder_reminders (
    id TEXT PRIMARY KEY,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL,
    time_local TEXT NOT NULL,
    days_of_week TEXT NOT NULL,
    timezone TEXT NOT NULL,
    voice_text TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX elder_reminders_elder ON elder_reminders (elder_user_id, active);

CREATE TABLE elder_reminder_events (
    id TEXT PRIMARY KEY,
    reminder_id TEXT NOT NULL REFERENCES elder_reminders (id) ON DELETE CASCADE,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    occurrence_at TEXT NOT NULL,
    status TEXT NOT NULL,
    acked_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (reminder_id, occurrence_at)
);

CREATE TABLE elder_contacts (
    id TEXT PRIMARY KEY,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    phone_encrypted BLOB NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE elder_tutorials (
    id TEXT PRIMARY KEY,
    elder_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
    created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX elder_tutorials_owner ON elder_tutorials (elder_user_id);

CREATE TABLE fraud_scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE elder_number_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    phone_lookup TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, phone_lookup)
);

CREATE INDEX elder_number_flags_lookup ON elder_number_flags (phone_lookup);

CREATE TABLE elder_activity_log (
    id TEXT PRIMARY KEY,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX elder_activity_log_elder ON elder_activity_log (elder_user_id, created_at);

CREATE TABLE elder_notices (
    id TEXT PRIMARY KEY,
    caregiver_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX elder_notices_caregiver ON elder_notices (caregiver_user_id, created_at);

CREATE TABLE elder_sms_log (
    id TEXT PRIMARY KEY,
    to_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    elder_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE elder_content_editors (
    user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO elder_tutorials (id, elder_user_id, created_by_user_id, title, steps_json, created_at, updated_at)
VALUES
(
    '00000000-0000-4000-8000-000000000001',
    NULL,
    NULL,
    '医院挂号',
    '[{"text":"打开医院公众号或国家医保服务平台"},{"text":"选择就诊医院与科室"},{"text":"确认就诊人并提交，记下预约时间"}]',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
),
(
    '00000000-0000-4000-8000-000000000002',
    NULL,
    NULL,
    '社保认证',
    '[{"text":"打开电子社保卡或当地人社 App"},{"text":"进入待遇资格认证"},{"text":"按提示完成人脸识别，看到成功即可"}]',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
),
(
    '00000000-0000-4000-8000-000000000003',
    NULL,
    NULL,
    '健康码/扫码',
    '[{"text":"打开微信或支付宝"},{"text":"点扫一扫，对准场所码"},{"text":"确认本人信息后给工作人员查看"}]',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
);

INSERT INTO fraud_scripts (id, title, body, source_name, source_url, created_at, updated_at)
VALUES
(
    '00000000-0000-4000-8000-000000000011',
    '冒充公检法',
    '自称公安、检察院、法院，说你的卡涉案、要冻结，或让你转到“安全账户”、提供验证码，都是诈骗。公检法不会电话办案，也不会要你转账自证清白。请挂断并拨打 110 或 96110。',
    '国家反诈中心',
    'https://www.gjfzpt.cn/',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
),
(
    '00000000-0000-4000-8000-000000000012',
    '刷单返利',
    '先小额返利再要求垫资、充值、做更多任务，随后失联，都是诈骗。刷单本身违法。不要信“高佣金兼职刷单”。',
    '国家反诈中心（公安机关防诈关键词转载）',
    'http://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202506/t20250620_521303.html',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
),
(
    '00000000-0000-4000-8000-000000000013',
    '虚假投资理财',
    '陌生群推荐“内部消息、稳赚不赔、高额回报”，或要求下载不明投资 App 充值，都是诈骗。本应用不提供理财建议。',
    '国家反诈中心',
    'https://www.gjfzpt.cn/',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
),
(
    '00000000-0000-4000-8000-000000000014',
    '客服退款/快递理赔',
    '自称电商客服、快递或银行，说订单异常要退款，让你点链接、下载远控软件或把钱转到“核对账户”，都是诈骗。请走官方 App 订单页。',
    '国家反诈中心',
    'https://www.gjfzpt.cn/',
    '2026-10-13T00:00:00Z',
    '2026-10-13T00:00:00Z'
);
