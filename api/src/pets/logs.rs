use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    owned_pet, parse_date, parse_logged_at, require_log_type, CreateLogBody, CreateWeightBody,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct WeightRow {
    id: String,
    pet_id: String,
    measured_on: String,
    weight_g: i64,
    created_at: String,
}

impl WeightRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "pet_id": self.pet_id,
            "measured_on": self.measured_on,
            "weight_g": self.weight_g,
            "created_at": self.created_at,
        })
    }
}

#[derive(FromRow)]
struct LogRow {
    id: String,
    pet_id: String,
    type_name: String,
    value: Option<String>,
    logged_at: String,
    created_at: String,
}

impl LogRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "pet_id": self.pet_id,
            "type": self.type_name,
            "value": self.value,
            "logged_at": self.logged_at,
            "created_at": self.created_at,
        })
    }
}

pub async fn list_weights(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let items = load_weights(&state, &user.user_id, Some(&pet_id)).await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn create_weight(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
    Json(body): Json<CreateWeightBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    if body.weight_g <= 0 {
        return Err(AppError::InvalidRequest("weight_g must be > 0".into()));
    }
    let measured_on = parse_date(&body.measured_on)?.to_string();
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO pet_weights (id, pet_id, user_id, measured_on, weight_g, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&pet_id)
    .bind(&user.user_id)
    .bind(&measured_on)
    .bind(body.weight_g)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, WeightRow>(
        "SELECT id, pet_id, measured_on, weight_g, created_at FROM pet_weights WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let items = load_logs(&state, &user.user_id, Some(&pet_id)).await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
    Json(body): Json<CreateLogBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let type_name = require_log_type(&body.type_name)?;
    let value = body
        .value
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned);
    let logged_at = parse_logged_at(body.logged_at.as_deref())?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO pet_daily_logs (id, pet_id, user_id, type, value, logged_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&pet_id)
    .bind(&user.user_id)
    .bind(type_name)
    .bind(&value)
    .bind(&logged_at)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, LogRow>(
        "SELECT id, pet_id, type AS type_name, value, logged_at, created_at
         FROM pet_daily_logs WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn export_weights(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    load_weights(state, user_id, None).await
}

pub async fn export_logs(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    load_logs(state, user_id, None).await
}

async fn load_weights(
    state: &AppState,
    user_id: &str,
    pet_id: Option<&str>,
) -> Result<Vec<Value>, AppError> {
    let rows = if let Some(pet_id) = pet_id {
        sqlx::query_as::<_, WeightRow>(
            "SELECT id, pet_id, measured_on, weight_g, created_at FROM pet_weights
             WHERE user_id = ? AND pet_id = ? ORDER BY measured_on, created_at",
        )
        .bind(user_id)
        .bind(pet_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    } else {
        sqlx::query_as::<_, WeightRow>(
            "SELECT id, pet_id, measured_on, weight_g, created_at FROM pet_weights
             WHERE user_id = ? ORDER BY measured_on, created_at",
        )
        .bind(user_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    };
    Ok(rows.iter().map(WeightRow::public).collect())
}

async fn load_logs(
    state: &AppState,
    user_id: &str,
    pet_id: Option<&str>,
) -> Result<Vec<Value>, AppError> {
    let rows = if let Some(pet_id) = pet_id {
        sqlx::query_as::<_, LogRow>(
            "SELECT id, pet_id, type AS type_name, value, logged_at, created_at
             FROM pet_daily_logs WHERE user_id = ? AND pet_id = ?
             ORDER BY logged_at DESC, created_at DESC",
        )
        .bind(user_id)
        .bind(pet_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    } else {
        sqlx::query_as::<_, LogRow>(
            "SELECT id, pet_id, type AS type_name, value, logged_at, created_at
             FROM pet_daily_logs WHERE user_id = ?
             ORDER BY logged_at DESC, created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    };
    Ok(rows.iter().map(LogRow::public).collect())
}
