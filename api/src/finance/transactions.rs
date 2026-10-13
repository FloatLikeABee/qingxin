use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use super::{
    encrypt_note, load_category_for_user, load_tx, require_client_id, require_cny, require_fen,
    require_kind, CreateTxBody, PatchTxBody, TxQuery, TxRow, TX_SELECT,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<TxQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let (month_start, month_end) = match query.month.as_deref() {
        Some(month) => {
            let bounds = super::month_bounds(month)?;
            (Some(bounds.0), Some(bounds.1))
        }
        None => (None, None),
    };
    let type_name = match query.type_name.as_deref() {
        Some(raw) => Some(super::require_kind(raw)?.to_string()),
        None => None,
    };
    let cursor = query
        .cursor
        .as_deref()
        .map(|raw| {
            raw.split_once('|')
                .ok_or_else(|| AppError::InvalidRequest("cursor is invalid".into()))
                .map(|(day, id)| (day.to_string(), id.to_string()))
        })
        .transpose()?;

    let mut sql = format!("{TX_SELECT} WHERE t.user_id = ? AND t.deleted_at IS NULL");
    if month_start.is_some() {
        sql.push_str(" AND t.occurred_on >= ? AND t.occurred_on <= ?");
    }
    if type_name.is_some() {
        sql.push_str(" AND t.type = ?");
    }
    if query.category_id.is_some() {
        sql.push_str(" AND t.category_id = ?");
    }
    if cursor.is_some() {
        sql.push_str(" AND (t.occurred_on < ? OR (t.occurred_on = ? AND t.id < ?))");
    }
    sql.push_str(" ORDER BY t.occurred_on DESC, t.id DESC LIMIT ?");

    let mut q = sqlx::query_as::<_, TxRow>(&sql).bind(&user.user_id);
    if let (Some(start), Some(end)) = (&month_start, &month_end) {
        q = q.bind(start).bind(end);
    }
    if let Some(kind) = &type_name {
        q = q.bind(kind);
    }
    if let Some(category_id) = &query.category_id {
        q = q.bind(category_id);
    }
    if let Some((day, id)) = &cursor {
        q = q.bind(day).bind(day).bind(id);
    }
    let rows = q
        .bind(limit + 1)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?;
    let has_more = rows.len() as i64 > limit;
    let items: Vec<Value> = rows
        .iter()
        .take(limit as usize)
        .map(|row| row.public(&state.crypto))
        .collect();
    let next_cursor = if has_more {
        rows.get(limit as usize - 1)
            .map(|row| format!("{}|{}", row.occurred_on, row.id))
    } else {
        None
    };
    Ok(Json(json!({ "items": items, "next_cursor": next_cursor })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateTxBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let amount = require_fen(body.amount_fen)?;
    require_cny(body.currency.as_deref())?;
    let type_name = require_kind(body.type_name.trim())?;
    let client_id = require_client_id(&body.client_id)?;
    let occurred_on = super::parse_date(&body.occurred_on)?.to_string();
    let category = load_category_for_user(&state, &user.user_id, body.category_id.trim()).await?;
    if category.kind != type_name {
        return Err(AppError::InvalidRequest(
            "category kind must match type".into(),
        ));
    }
    if let Some(existing) = sqlx::query_as::<_, TxRow>(&format!(
        "{TX_SELECT} WHERE t.user_id = ? AND t.client_id = ?"
    ))
    .bind(&user.user_id)
    .bind(&client_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    {
        return Ok((StatusCode::OK, Json(existing.public(&state.crypto))));
    }

    let note = encrypt_note(&state.crypto, body.note.as_deref())?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO fin_transactions
            (id, user_id, amount_fen, type, category_id, note_encrypted, occurred_on, client_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(amount)
    .bind(type_name)
    .bind(&category.id)
    .bind(note)
    .bind(&occurred_on)
    .bind(&client_id)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_tx(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public(&state.crypto))))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = load_tx(&state, &user.user_id, &id).await?;
    Ok(Json(row.public(&state.crypto)))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchTxBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_tx(&state, &user.user_id, &id).await?;
    let amount = match body.amount_fen {
        Some(value) => require_fen(value)?,
        None => current.amount_fen,
    };
    let type_name = match body.type_name.as_deref() {
        Some(raw) => require_kind(raw)?.to_string(),
        None => current.type_name.clone(),
    };
    let category_id = body
        .category_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(current.category_id.as_str());
    let category = load_category_for_user(&state, &user.user_id, category_id).await?;
    if category.kind != type_name {
        return Err(AppError::InvalidRequest(
            "category kind must match type".into(),
        ));
    }
    let occurred_on = match body.occurred_on.as_deref() {
        Some(raw) => super::parse_date(raw)?.to_string(),
        None => current.occurred_on.clone(),
    };
    let note = if body.note.is_some() {
        encrypt_note(&state.crypto, body.note.as_deref())?
    } else {
        current.note_encrypted.clone()
    };
    sqlx::query(
        "UPDATE fin_transactions
         SET amount_fen = ?, type = ?, category_id = ?, note_encrypted = ?, occurred_on = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
    .bind(amount)
    .bind(&type_name)
    .bind(&category.id)
    .bind(note)
    .bind(&occurred_on)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_tx(&state, &user.user_id, &id).await?;
    Ok(Json(row.public(&state.crypto)))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        "UPDATE fin_transactions SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
    .bind(now_rfc3339())
    .bind(now_rfc3339())
    .bind(id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
