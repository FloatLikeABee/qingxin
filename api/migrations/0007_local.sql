-- M4 local life. SQLite-first, Postgres-ready.

CREATE TABLE services (
    id TEXT PRIMARY KEY,
    created_by TEXT REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    rating_avg REAL NOT NULL,
    hours TEXT,
    phone TEXT,
    hero_key TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX services_category ON services (category);
CREATE INDEX services_created_by ON services (created_by);

CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER,
    images_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX reviews_service_created ON reviews (service_id, created_at);
CREATE INDEX reviews_user ON reviews (user_id);

CREATE TABLE service_corrections (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX service_corrections_service ON service_corrections (service_id);
CREATE INDEX service_corrections_user ON service_corrections (user_id);

INSERT INTO services (
    id, created_by, name, category, latitude, longitude, address, tags_json,
    rating_avg, hours, phone, hero_key, created_at
) VALUES
(
    'a1e1c0de-0001-4000-8000-000000000001',
    NULL,
    '轻心宠物医院',
    '宠物',
    31.2318,
    121.4754,
    '静安区轻心路 12 号',
    '["有坡道","耐心服务"]',
    4.8,
    '09:00–21:00',
    '021-5555-0101',
    'pet',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000002',
    NULL,
    '暖光家电维修',
    '维修',
    31.2299,
    121.4721,
    '静安区梧桐巷 6 号',
    '["耐心服务"]',
    4.6,
    '08:30–18:30',
    '021-5555-0102',
    'repair',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000003',
    NULL,
    '社区配送站',
    '配送',
    31.2309,
    121.4748,
    '静安区轻心路 28 号',
    '[]',
    4.4,
    '07:00–22:00',
    '021-5555-0103',
    'delivery',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000004',
    NULL,
    '慢行食堂',
    '适老',
    31.2294,
    121.4739,
    '静安区银杏街 3 号',
    '["有坡道","大字菜单","耐心服务"]',
    4.9,
    '07:00–19:30',
    '021-5555-0104',
    'elder',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000005',
    NULL,
    '毛孩子洗护',
    '宠物',
    31.2321,
    121.4728,
    '静安区轻心路 41 号',
    '["耐心服务"]',
    4.5,
    '10:00–20:00',
    '021-5555-0105',
    'pet',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000006',
    NULL,
    '夕阳配餐',
    '配送',
    31.2288,
    121.4750,
    '静安区银杏街 15 号',
    '["大字菜单","耐心服务"]',
    4.7,
    '10:00–18:00',
    '021-5555-0106',
    'delivery',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000007',
    NULL,
    '银发理发屋',
    '适老',
    31.2312,
    121.4719,
    '静安区梧桐巷 19 号',
    '["有坡道","大字菜单"]',
    4.7,
    '09:00–18:00',
    '021-5555-0107',
    'elder',
    '2026-10-01T02:00:00Z'
),
(
    'a1e1c0de-0001-4000-8000-000000000008',
    NULL,
    '钥匙应急铺',
    '维修',
    31.2301,
    121.4760,
    '静安区轻心路 55 号',
    '[]',
    4.3,
    '00:00–24:00',
    '021-5555-0108',
    'repair',
    '2026-10-01T02:00:00Z'
);
