use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::moderation::Decision;
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const COMMUNITY_LAT: f64 = 31.230_416;
pub const COMMUNITY_LNG: f64 = 121.473_701;

const CATEGORIES: &[&str] = &["维修", "宠物", "配送", "适老"];
const ELDER_TAGS: &[&str] = &["有坡道", "大字菜单", "耐心服务"];
const CORRECTION_KINDS: &[&str] = &["已搬迁", "电话空号"];
const HERO_KEYS: &[&str] = &["pet", "repair", "delivery", "elder"];

#[derive(Clone, FromRow)]
struct ServiceRow {
    id: String,
    created_by: Option<String>,
    name: String,
    category: String,
    latitude: f64,
    longitude: f64,
    address: String,
    tags_json: String,
    rating_avg: f64,
    hours: Option<String>,
    phone: Option<String>,
    hero_key: Option<String>,
    created_at: String,
}

#[derive(Clone, FromRow)]
struct ReviewRow {
    id: String,
    service_id: String,
    user_id: String,
    content: String,
    rating: Option<i64>,
    images_json: String,
    created_at: String,
}

#[derive(Clone, FromRow)]
struct CorrectionRow {
    id: String,
    service_id: String,
    user_id: String,
    kind: String,
    created_at: String,
}

#[derive(Serialize)]
pub struct ReviewPublic {
    pub id: String,
    pub service_id: String,
    pub user_id: String,
    pub content: String,
    pub rating: Option<i64>,
    pub images: Vec<String>,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct CorrectionPublic {
    pub id: String,
    pub service_id: String,
    pub user_id: String,
    pub kind: String,
    pub created_at: String,
}

impl ReviewRow {
    fn public(self) -> ReviewPublic {
        ReviewPublic {
            id: self.id,
            service_id: self.service_id,
            user_id: self.user_id,
            content: self.content,
            rating: self.rating,
            images: parse_string_list(&self.images_json),
            created_at: self.created_at,
        }
    }
}

impl CorrectionRow {
    fn public(self) -> CorrectionPublic {
        CorrectionPublic {
            id: self.id,
            service_id: self.service_id,
            user_id: self.user_id,
            kind: self.kind,
            created_at: self.created_at,
        }
    }
}

pub fn haversine_m(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    const R: f64 = 6_371_000.0;
    let phi1 = lat1.to_radians();
    let phi2 = lat2.to_radians();
    let d_phi = (lat2 - lat1).to_radians();
    let d_lambda = (lng2 - lng1).to_radians();
    let a = (d_phi / 2.0).sin().powi(2) + phi1.cos() * phi2.cos() * (d_lambda / 2.0).sin().powi(2);
    2.0 * R * a.sqrt().asin()
}

fn parse_string_list(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn service_public(row: &ServiceRow, origin_lat: f64, origin_lng: f64, counts: &Value) -> Value {
    json!({
        "id": row.id,
        "name": row.name,
        "category": row.category,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "address": row.address,
        "tags": parse_string_list(&row.tags_json),
        "rating_avg": row.rating_avg,
        "hours": row.hours,
        "phone": row.phone,
        "hero_key": row.hero_key,
        "created_at": row.created_at,
        "created_by": row.created_by,
        "distance_m": haversine_m(origin_lat, origin_lng, row.latitude, row.longitude).round(),
        "correction_counts": counts
    })
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/v1/local/services",
            get(list_services).post(create_service),
        )
        .route("/v1/local/services/{id}", get(get_service))
        .route(
            "/v1/local/services/{id}/reviews",
            get(list_reviews).post(create_review),
        )
        .route(
            "/v1/local/services/{id}/corrections",
            post(create_correction),
        )
}

#[derive(Deserialize)]
struct ListQuery {
    q: Option<String>,
    category: Option<String>,
    tag: Option<String>,
    sort: Option<String>,
    lat: Option<f64>,
    lng: Option<f64>,
}

#[derive(Deserialize)]
struct CreateServiceBody {
    id: Option<String>,
    name: Option<String>,
    category: String,
    address: Option<String>,
    latitude: f64,
    longitude: f64,
    hours: Option<String>,
    phone: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    hero_key: Option<String>,
}

#[derive(Deserialize)]
struct CreateReviewBody {
    id: Option<String>,
    content: String,
    rating: Option<i64>,
    #[serde(default)]
    images: Vec<String>,
}

#[derive(Deserialize)]
struct CreateCorrectionBody {
    id: Option<String>,
    kind: String,
}

fn client_or_new_id(raw: Option<&str>) -> Result<String, AppError> {
    match raw {
        Some(value) if !value.trim().is_empty() => Uuid::parse_str(value.trim())
            .map(|id| id.to_string())
            .map_err(|_| AppError::InvalidRequest("id must be a uuid".into())),
        _ => Ok(new_id()),
    }
}

fn require_text(raw: Option<&str>, field: &str) -> Result<String, AppError> {
    let value = raw.map(str::trim).unwrap_or_default();
    if value.is_empty() {
        return Err(AppError::InvalidRequest(format!("{field} is required")));
    }
    Ok(value.to_string())
}

fn validate_category(category: &str) -> Result<(), AppError> {
    if CATEGORIES.contains(&category) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!(
            "unknown category: {category}"
        )))
    }
}

fn validate_tags(tags: &[String]) -> Result<(), AppError> {
    for tag in tags {
        if !ELDER_TAGS.contains(&tag.as_str()) {
            return Err(AppError::InvalidRequest(format!("unknown tag: {tag}")));
        }
    }
    Ok(())
}

fn validate_kind(kind: &str) -> Result<(), AppError> {
    if CORRECTION_KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!("unknown kind: {kind}")))
    }
}

fn validate_hero(hero: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(key) = hero.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if HERO_KEYS.contains(&key) {
        Ok(Some(key.to_string()))
    } else {
        Err(AppError::InvalidRequest(format!("unknown hero_key: {key}")))
    }
}

fn normalize_content(raw: &str) -> Result<String, AppError> {
    let content = raw.trim();
    if content.is_empty() {
        return Err(AppError::InvalidRequest("content is required".into()));
    }
    if content.chars().count() > 500 {
        return Err(AppError::InvalidRequest(
            "content must be 500 characters or fewer".into(),
        ));
    }
    Ok(content.to_string())
}

async fn moderate(state: &AppState, text: &str) -> Result<(), AppError> {
    match state.moderator.check(text).await {
        Ok(Decision::Allow) => Ok(()),
        Ok(Decision::Reject { reason }) => Err(AppError::InvalidRequest(reason)),
        Err(err) => Err(AppError::Unavailable(err.to_string())),
    }
}

fn origin_from(query: &ListQuery) -> (f64, f64) {
    (
        query.lat.unwrap_or(COMMUNITY_LAT),
        query.lng.unwrap_or(COMMUNITY_LNG),
    )
}

fn empty_counts() -> Value {
    json!({ "已搬迁": 0, "电话空号": 0 })
}

async fn correction_counts(state: &AppState, service_id: &str) -> Result<Value, AppError> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT kind, COUNT(*) FROM service_corrections WHERE service_id = ? GROUP BY kind",
    )
    .bind(service_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut counts = json!({ "已搬迁": 0, "电话空号": 0 });
    for (kind, n) in rows {
        counts[kind] = json!(n);
    }
    Ok(counts)
}

async fn load_service(state: &AppState, id: &str) -> Result<ServiceRow, AppError> {
    sqlx::query_as::<_, ServiceRow>(
        "SELECT id, created_by, name, category, latitude, longitude, address, tags_json,
                rating_avg, hours, phone, hero_key, created_at
         FROM services WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_service_rows(state: &AppState) -> Result<Vec<ServiceRow>, AppError> {
    sqlx::query_as::<_, ServiceRow>(
        "SELECT id, created_by, name, category, latitude, longitude, address, tags_json,
                rating_avg, hours, phone, hero_key, created_at
         FROM services",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

async fn list_services(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<Value>, AppError> {
    if let Some(category) = query.category.as_deref() {
        validate_category(category)?;
    }
    if let Some(tag) = query.tag.as_deref() {
        if !ELDER_TAGS.contains(&tag) {
            return Err(AppError::InvalidRequest(format!("unknown tag: {tag}")));
        }
    }
    let sort = query.sort.as_deref().unwrap_or("distance");
    if !matches!(sort, "distance" | "rating") {
        return Err(AppError::InvalidRequest(format!("unknown sort: {sort}")));
    }
    let (origin_lat, origin_lng) = origin_from(&query);
    let q = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let mut rows = list_service_rows(&state).await?;
    if let Some(category) = query.category.as_deref() {
        rows.retain(|row| row.category == category);
    }
    if let Some(needle) = q.as_deref() {
        rows.retain(|row| row.name.contains(needle) || row.address.contains(needle));
    }
    if let Some(tag) = query.tag.as_deref() {
        rows.retain(|row| {
            parse_string_list(&row.tags_json)
                .iter()
                .any(|item| item == tag)
        });
    }
    match sort {
        "rating" => rows.sort_by(|a, b| {
            b.rating_avg
                .partial_cmp(&a.rating_avg)
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        _ => rows.sort_by(|a, b| {
            haversine_m(origin_lat, origin_lng, a.latitude, a.longitude)
                .partial_cmp(&haversine_m(
                    origin_lat,
                    origin_lng,
                    b.latitude,
                    b.longitude,
                ))
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
    }
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let counts = correction_counts(&state, &row.id).await?;
        items.push(service_public(&row, origin_lat, origin_lng, &counts));
    }
    Ok(Json(json!({ "items": items })))
}

async fn get_service(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = load_service(&state, &id).await?;
    let counts = correction_counts(&state, &id).await?;
    Ok(Json(service_public(
        &row,
        COMMUNITY_LAT,
        COMMUNITY_LNG,
        &counts,
    )))
}

async fn create_service(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateServiceBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let name = require_text(body.name.as_deref(), "name")?;
    let address = require_text(body.address.as_deref(), "address")?;
    validate_category(&body.category)?;
    validate_tags(&body.tags)?;
    let hero = validate_hero(body.hero_key.as_deref())?;
    moderate(&state, &format!("{name}\n{address}")).await?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let tags_json = serde_json::to_string(&body.tags).unwrap_or_else(|_| "[]".into());
    let inserted = sqlx::query(
        "INSERT INTO services (
            id, created_by, name, category, latitude, longitude, address, tags_json,
            rating_avg, hours, phone, hero_key, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&name)
    .bind(&body.category)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(&address)
    .bind(&tags_json)
    .bind(&body.hours)
    .bind(&body.phone)
    .bind(&hero)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        let row = load_service(&state, &id).await?;
        let counts = correction_counts(&state, &id).await?;
        return Ok((
            StatusCode::CREATED,
            Json(service_public(&row, COMMUNITY_LAT, COMMUNITY_LNG, &counts)),
        ));
    }
    let row = load_service(&state, &id).await?;
    Ok((
        StatusCode::CREATED,
        Json(service_public(
            &row,
            COMMUNITY_LAT,
            COMMUNITY_LNG,
            &empty_counts(),
        )),
    ))
}

async fn list_reviews(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    load_service(&state, &id).await?;
    let rows = sqlx::query_as::<_, ReviewRow>(
        "SELECT id, service_id, user_id, content, rating, images_json, created_at
         FROM reviews WHERE service_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.into_iter().map(ReviewRow::public).collect::<Vec<_>>()
    })))
}

async fn create_review(
    State(state): State<AppState>,
    user: AuthUser,
    Path(service_id): Path<String>,
    Json(body): Json<CreateReviewBody>,
) -> Result<(StatusCode, Json<ReviewPublic>), AppError> {
    load_service(&state, &service_id).await?;
    let content = normalize_content(&body.content)?;
    if let Some(rating) = body.rating {
        if !(1..=5).contains(&rating) {
            return Err(AppError::InvalidRequest("rating must be 1..=5".into()));
        }
    }
    moderate(&state, &content).await?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let images_json = serde_json::to_string(&body.images).unwrap_or_else(|_| "[]".into());
    let inserted = sqlx::query(
        "INSERT INTO reviews (id, service_id, user_id, content, rating, images_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&service_id)
    .bind(&user.user_id)
    .bind(&content)
    .bind(body.rating)
    .bind(&images_json)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        let row = load_review(&state, &id).await?;
        return Ok((StatusCode::CREATED, Json(row.public())));
    }
    recompute_rating(&state, &service_id).await?;
    let row = load_review(&state, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

async fn load_review(state: &AppState, id: &str) -> Result<ReviewRow, AppError> {
    sqlx::query_as::<_, ReviewRow>(
        "SELECT id, service_id, user_id, content, rating, images_json, created_at
         FROM reviews WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn recompute_rating(state: &AppState, service_id: &str) -> Result<(), AppError> {
    let avg: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(rating) FROM reviews WHERE service_id = ? AND rating IS NOT NULL",
    )
    .bind(service_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if let Some(avg) = avg {
        sqlx::query("UPDATE services SET rating_avg = ? WHERE id = ?")
            .bind(avg)
            .bind(service_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
    }
    Ok(())
}

async fn create_correction(
    State(state): State<AppState>,
    user: AuthUser,
    Path(service_id): Path<String>,
    Json(body): Json<CreateCorrectionBody>,
) -> Result<(StatusCode, Json<CorrectionPublic>), AppError> {
    load_service(&state, &service_id).await?;
    validate_kind(&body.kind)?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let inserted = sqlx::query(
        "INSERT INTO service_corrections (id, service_id, user_id, kind, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&service_id)
    .bind(&user.user_id)
    .bind(&body.kind)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        let row = load_correction(&state, &id).await?;
        return Ok((StatusCode::CREATED, Json(row.public())));
    }
    let row = load_correction(&state, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

async fn load_correction(state: &AppState, id: &str) -> Result<CorrectionRow, AppError> {
    sqlx::query_as::<_, CorrectionRow>(
        "SELECT id, service_id, user_id, kind, created_at FROM service_corrections WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn export_reviews(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<ReviewPublic>, AppError> {
    let rows = sqlx::query_as::<_, ReviewRow>(
        "SELECT id, service_id, user_id, content, rating, images_json, created_at
         FROM reviews WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.into_iter().map(ReviewRow::public).collect())
}

pub async fn export_services(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, ServiceRow>(
        "SELECT id, created_by, name, category, latitude, longitude, address, tags_json,
                rating_avg, hours, phone, hero_key, created_at
         FROM services WHERE created_by = ?",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let counts = correction_counts(state, &row.id).await?;
        items.push(service_public(&row, COMMUNITY_LAT, COMMUNITY_LNG, &counts));
    }
    Ok(items)
}

pub async fn export_corrections(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<CorrectionPublic>, AppError> {
    let rows = sqlx::query_as::<_, CorrectionRow>(
        "SELECT id, service_id, user_id, kind, created_at
         FROM service_corrections WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.into_iter().map(CorrectionRow::public).collect())
}
