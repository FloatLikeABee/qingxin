# Spec Delta

## Purpose

Lets a person search a seeded 15-minute neighborhood for repair, pet, delivery, and elder-friendly services, switch map and list, open detail to call or navigate, leave a review, flag a correction, and submit a new listing.

## ADDED Requirements

### Requirement: Seeded service catalog
The system SHALL persist `services` rows with `id`, `name`, `category`, `latitude`, `longitude`, `address`, `tags`, `rating_avg`, plus hours, phone, and an optional hero key. A migration SHALL seed a demo neighborhood that includes a 宠物医院 listing. Categories SHALL be a closed catalog: `维修`, `宠物`, `配送`, `适老`.

#### Scenario: Seed includes a pet hospital
- **WHEN** an authenticated client lists services with no filters
- **THEN** the items include a service whose name contains `宠物医院` and whose category is `宠物`

#### Scenario: Unknown category is rejected
- **WHEN** a client publishes a service with category `酒吧`
- **THEN** the response is 400 with error code `invalid_request`

### Requirement: Search, filter, and sort
`GET /v1/local/services` SHALL require authentication. Optional `q` SHALL match name or address (case-insensitive substring). Optional `category` and `tag` SHALL restrict the set. `sort=distance` SHALL order by haversine meters from `lat`/`lng` (defaulting to the seeded community origin). `sort=rating` SHALL order by `rating_avg` descending. Unknown `sort` SHALL return 400. Each item SHALL include `distance_m`.

#### Scenario: Search 宠物医院
- **WHEN** the caller lists with `q=宠物医院`
- **THEN** every returned name contains `宠物医院` and at least one item is present

#### Scenario: Sort by rating
- **WHEN** the caller lists with `sort=rating`
- **THEN** items are in non-increasing `rating_avg` order

#### Scenario: List requires a token
- **WHEN** a client lists `/v1/local/services` without an Authorization header
- **THEN** the response is 401 with error code `unauthenticated`

### Requirement: Service detail
`GET /v1/local/services/{id}` SHALL return hours, phone, address, tags, rating, hero key, and coordinates for a seeded or published service. A missing id SHALL return 404.

#### Scenario: Detail includes call fields
- **WHEN** the caller fetches the seeded 宠物医院 id
- **THEN** the response includes `hours`, `phone`, `address`, and `tags`

### Requirement: Elder-friendly tags
Service `tags` SHALL be a subset of `有坡道`, `大字菜单`, `耐心服务`. Unknown tags on publish SHALL return 400.

#### Scenario: Elder tag filter
- **WHEN** the caller lists with `tag=有坡道` after seed
- **THEN** every returned item includes `有坡道` and at least one item is present

### Requirement: Reviews
`GET /v1/local/services/{id}/reviews` SHALL return that service's reviews newest first. `POST` SHALL create a review for the authenticated user with `content` (1..=500 characters) and optional `images`. Empty or too-long content SHALL return 400. The new review SHALL update `rating_avg` when `rating` (1..=5) is provided.

#### Scenario: Review create
- **WHEN** a signed-in client posts `{ "content": "医生很耐心", "rating": 5 }` to a seeded service
- **THEN** the response is 201 and a subsequent list includes that content

#### Scenario: Review too long
- **WHEN** a client posts content of 501 characters
- **THEN** the response is 400 with error code `invalid_request`

### Requirement: Correction flags
`POST /v1/local/services/{id}/corrections` SHALL accept `kind` `已搬迁` or `电话空号` from the authenticated user. Unknown kind SHALL return 400. A later GET of that service SHALL include `correction_counts` for those kinds.

#### Scenario: Flag a dead phone
- **WHEN** the caller posts `{ "kind": "电话空号" }`
- **THEN** the response is 201 and the service detail `correction_counts.电话空号` is at least 1

### Requirement: Publish a service
`POST /v1/local/services` SHALL create a service from name, category, address, latitude, longitude, optional hours, phone, and tags. Client UUID `id` SHALL be idempotent. Missing name SHALL return 400. Published rows SHALL appear in subsequent lists.

#### Scenario: Publish succeeds
- **WHEN** a signed-in client posts a 维修 listing with name, address, and coordinates
- **THEN** the response is 201 and listing by that id returns the name

### Requirement: Map provider seam
The web client SHALL render the neighborhood through a `MapProvider` interface with at least `stub` and `osm` adapters. `stub` SHALL draw an in-process SVG (no network, no API key). The client SHALL select `stub` when offline, when Playwright `navigator.webdriver` is set, or when no provider preference is stored. `osm` MAY use free raster tiles without a paid key and MUST NOT be the CI default.

#### Scenario: Stub is the CI default
- **WHEN** `selectMapProvider` runs with `webdriver: true`
- **THEN** the chosen provider id is `stub`

#### Scenario: Offline falls back to stub
- **WHEN** `selectMapProvider` runs with `online: false` and preference `osm`
- **THEN** the chosen provider id is `stub`

### Requirement: Map and list dual view
The `/modules/local` module SHALL offer a 地图 / 列表 toggle, a top search field, and bottom quick categories for 维修, 宠物, 配送, and 适老. Selecting a map marker or list row SHALL open a card, then a detail surface with hero, info, reviews, and a bottom bar for 导航 and 拨打.

#### Scenario: Search flow
- **WHEN** a signed-in user opens `/modules/local`, types 宠物医院, and opens the matching card
- **THEN** the detail heading includes 宠物医院 and 拨打 / 导航 actions are visible
