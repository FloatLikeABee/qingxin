use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{decrypt_text, encrypt_text, CreateSleepBody, PatchSleepBody};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct SleepRow {
    id: String,
    sleep_at: String,
    wake_at: String,
    quality: i64,
    note_encrypted: Option<Vec<u8>>,
    created_at: String,
}

impl SleepRow {
    fn public(&self, crypto: &FieldCrypto) -> Value {
        json!({
            "id": self.id,
            "sleep_at": self.sleep_at,
            "wake_at": self.wake_at,
            "quality": self.quality,
            "note": decrypt_text(crypto, self.note_encrypted.as_deref()),
            "created_at": self.created_at,
            "disclaimer": super::DISCLAIMER,
        })
    }
}

fn require_quality(quality: i64) -> Result<i64, AppError> {
    if !(1..=5).contains(&quality) {
        return Err(AppError::InvalidRequest("quality must be 1-5".into()));
    }
    Ok(quality)
}

fn parse_instant(raw: &str) -> Result<DateTime<Utc>, AppError> {
    DateTime::parse_from_rfc3339(raw.trim())
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| AppError::InvalidRequest("sleep_at and wake_at must be RFC3339".into()))
}

fn require_range(sleep_at: &str, wake_at: &str) -> Result<(), AppError> {
    let sleep = parse_instant(sleep_at)?;
    let wake = parse_instant(wake_at)?;
    if wake <= sleep {
        return Err(AppError::InvalidRequest(
            "wake_at must be after sleep_at".into(),
        ));
    }
    Ok(())
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<SleepRow, AppError> {
    sqlx::query_as::<_, SleepRow>(
        "SELECT id, sleep_at, wake_at, quality, note_encrypted, created_at
         FROM well_sleep_logs WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn latest(state: &AppState, user_id: &str) -> Result<Option<Value>, AppError> {
    let row = sqlx::query_as::<_, SleepRow>(
        "SELECT id, sleep_at, wake_at, quality, note_encrypted, created_at
         FROM well_sleep_logs WHERE user_id = ? ORDER BY wake_at DESC, id DESC LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(row.map(|item| item.public(&state.crypto)))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, SleepRow>(
        "SELECT id, sleep_at, wake_at, quality, note_encrypted, created_at
         FROM well_sleep_logs WHERE user_id = ? ORDER BY wake_at DESC, id DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(&state.crypto)).collect())
}

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(
        json!({ "items": export_rows(&state, &user.user_id).await? }),
    ))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateSleepBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let quality = require_quality(body.quality)?;
    require_range(&body.sleep_at, &body.wake_at)?;
    let note = encrypt_text(&state.crypto, body.note.as_deref(), 200, "note")?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_sleep_logs
            (id, user_id, sleep_at, wake_at, quality, note_encrypted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(body.sleep_at.trim())
    .bind(body.wake_at.trim())
    .bind(quality)
    .bind(note)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(
            load_one(&state, &user.user_id, &id)
                .await?
                .public(&state.crypto),
        ),
    ))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(
        load_one(&state, &user.user_id, &id)
            .await?
            .public(&state.crypto),
    ))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchSleepBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let sleep_at = body
        .sleep_at
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.sleep_at);
    let wake_at = body
        .wake_at
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.wake_at);
    require_range(sleep_at, wake_at)?;
    let quality = match body.quality {
        Some(value) => require_quality(value)?,
        None => current.quality,
    };
    let note = if body.note.is_some() {
        encrypt_text(&state.crypto, body.note.as_deref(), 200, "note")?
    } else {
        current.note_encrypted.clone()
    };
    sqlx::query(
        "UPDATE well_sleep_logs SET sleep_at = ?, wake_at = ?, quality = ?, note_encrypted = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(sleep_at)
    .bind(wake_at)
    .bind(quality)
    .bind(note)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(
        load_one(&state, &user.user_id, &id)
            .await?
            .public(&state.crypto),
    ))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let _ = load_one(&state, &user.user_id, &id).await?;
    sqlx::query("DELETE FROM well_sleep_logs WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}
