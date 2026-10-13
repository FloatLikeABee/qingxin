use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use super::{load_category_for_user, CategoryRow, CreateCategoryBody, PatchCategoryBody};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, user_id, name, kind, sort_order FROM fin_categories
         WHERE user_id IS NULL OR user_id = ?
         ORDER BY kind, sort_order, name",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.iter().map(CategoryRow::public).collect::<Vec<_>>()
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateCategoryBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let kind = super::require_kind(body.kind.trim())?;
    let name = body.name.trim();
    if name.is_empty() || name.chars().count() > 32 {
        return Err(AppError::InvalidRequest("name is invalid".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO fin_categories (id, user_id, name, kind, sort_order, created_at)
         VALUES (?, ?, ?, ?, 100, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(name)
    .bind(kind)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_category_for_user(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchCategoryBody>,
) -> Result<Json<Value>, AppError> {
    let existing = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, user_id, name, kind, sort_order FROM fin_categories WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some(row) = existing else {
        return Err(AppError::NotFound);
    };
    if row.user_id.is_none() {
        return Err(AppError::Forbidden);
    }
    if row.user_id.as_deref() != Some(user.user_id.as_str()) {
        return Err(AppError::NotFound);
    }
    let name = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::InvalidRequest("name is invalid".into()))?;
    if name.chars().count() > 32 {
        return Err(AppError::InvalidRequest("name is invalid".into()));
    }
    sqlx::query("UPDATE fin_categories SET name = ? WHERE id = ? AND user_id = ?")
        .bind(name)
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    let row = load_category_for_user(&state, &user.user_id, &id).await?;
    Ok(Json(row.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, user_id, name, kind, sort_order FROM fin_categories WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some(row) = existing else {
        return Err(AppError::NotFound);
    };
    if row.user_id.is_none() {
        return Err(AppError::Forbidden);
    }
    if row.user_id.as_deref() != Some(user.user_id.as_str()) {
        return Err(AppError::NotFound);
    }
    let used: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM fin_transactions WHERE category_id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if used > 0 {
        return Err(AppError::Conflict);
    }
    sqlx::query("DELETE FROM fin_categories WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}
