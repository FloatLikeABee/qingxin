use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{parse_date, require_ml, shanghai_today, CreateWaterBody, DateQuery, DEFAULT_CUP_ML};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct WaterRow {
    id: String,
    logged_on: String,
    ml: i64,
    logged_at: String,
}

impl WaterRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "logged_on": self.logged_on,
            "ml": self.ml,
            "logged_at": self.logged_at,
        })
    }
}

pub async fn total_for_day(state: &AppState, user_id: &str, day: &str) -> Result<i64, AppError> {
    let total: Option<i64> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(ml), 0) FROM well_water_logs WHERE user_id = ? AND logged_on = ?",
    )
    .bind(user_id)
    .bind(day)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(total.unwrap_or(0))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, WaterRow>(
        "SELECT id, logged_on, ml, logged_at FROM well_water_logs
         WHERE user_id = ? ORDER BY logged_at DESC, id DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(WaterRow::public).collect())
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<WaterRow, AppError> {
    sqlx::query_as::<_, WaterRow>(
        "SELECT id, logged_on, ml, logged_at FROM well_water_logs WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<DateQuery>,
) -> Result<Json<Value>, AppError> {
    super::ensure_goals(&state, &user.user_id).await?;
    let mut sql =
        "SELECT id, logged_on, ml, logged_at FROM well_water_logs WHERE user_id = ?".to_string();
    if query.date.is_some() {
        sql.push_str(" AND logged_on = ?");
    }
    sql.push_str(" ORDER BY logged_at DESC, id DESC");
    let mut q = sqlx::query_as::<_, WaterRow>(&sql).bind(&user.user_id);
    if let Some(date) = query.date.as_deref() {
        parse_date(date)?;
        q = q.bind(date);
    }
    let rows = q.fetch_all(&state.pool).await.map_err(map_sqlx)?;
    Ok(Json(
        json!({ "items": rows.iter().map(WaterRow::public).collect::<Vec<_>>() }),
    ))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateWaterBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::ensure_goals(&state, &user.user_id).await?;
    let ml = require_ml(body.ml.unwrap_or(DEFAULT_CUP_ML))?;
    let logged_on = match body.logged_on.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => shanghai_today().to_string(),
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_water_logs (id, user_id, logged_on, ml, logged_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&logged_on)
    .bind(ml)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(load_one(&state, &user.user_id, &id).await?.public()),
    ))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(load_one(&state, &user.user_id, &id).await?.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let _ = load_one(&state, &user.user_id, &id).await?;
    sqlx::query("DELETE FROM well_water_logs WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}
