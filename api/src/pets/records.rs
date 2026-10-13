use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::NaiveDate;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    cancel_jobs_like, decrypt_note, due_run_at, encrypt_note, enqueue_job, optional_date,
    owned_pet, parse_date, require_record_type, CreateRecordBody, PatchRecordBody, DEFAULT_TZ,
    DISCLAIMER,
};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct RecordRow {
    id: String,
    pet_id: String,
    type_name: String,
    date: String,
    next_due_date: Option<String>,
    note_encrypted: Option<Vec<u8>>,
    created_at: String,
    updated_at: String,
}

impl RecordRow {
    fn public(&self, crypto: &FieldCrypto) -> Value {
        json!({
            "id": self.id,
            "pet_id": self.pet_id,
            "type": self.type_name,
            "date": self.date,
            "next_due_date": self.next_due_date,
            "note": decrypt_note(crypto, self.note_encrypted.as_deref()),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "disclaimer": DISCLAIMER,
        })
    }
}

const RECORD_SELECT: &str = "SELECT id, pet_id, type AS type_name, date, next_due_date,
        note_encrypted, created_at, updated_at FROM pet_health_records";

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<RecordRow, AppError> {
    sqlx::query_as::<_, RecordRow>(&format!("{RECORD_SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

async fn sync_due_job(state: &AppState, user_id: &str, row: &RecordRow) -> Result<(), AppError> {
    cancel_jobs_like(state, user_id, "pet.due", &row.id).await?;
    let Some(next) = row.next_due_date.as_deref() else {
        return Ok(());
    };
    let next_due = parse_date(next)?;
    let run_at = due_run_at(next_due, DEFAULT_TZ)?;
    let payload = json!({
        "type": "pet.due",
        "pet_id": row.pet_id,
        "record_id": row.id,
        "record_type": row.type_name,
        "next_due_date": next,
        "title": "宠物健康提醒",
        "body": format!("{} 将于 {} 到期", row.type_name, next),
        "disclaimer": DISCLAIMER,
    });
    enqueue_job(state, user_id, "pet.due", &run_at, &payload).await?;
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let rows = sqlx::query_as::<_, RecordRow>(&format!(
        "{RECORD_SELECT} WHERE user_id = ? AND pet_id = ? ORDER BY date DESC, created_at DESC"
    ))
    .bind(&user.user_id)
    .bind(&pet_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.iter().map(|row| row.public(&state.crypto)).collect::<Vec<_>>(),
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
    Json(body): Json<CreateRecordBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let type_name = require_record_type(&body.type_name)?;
    let date = parse_date(&body.date)?.to_string();
    let next_due_date = optional_date(body.next_due_date.as_deref())?;
    let note = encrypt_note(&state.crypto, body.note.as_deref())?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO pet_health_records
            (id, pet_id, user_id, type, date, next_due_date, note_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&pet_id)
    .bind(&user.user_id)
    .bind(type_name)
    .bind(&date)
    .bind(&next_due_date)
    .bind(&note)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    sync_due_job(&state, &user.user_id, &row).await?;
    Ok((StatusCode::CREATED, Json(row.public(&state.crypto))))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchRecordBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let type_name = if let Some(raw) = body.type_name.as_deref() {
        require_record_type(raw)?.to_string()
    } else {
        current.type_name
    };
    let date = if let Some(raw) = body.date.as_deref() {
        parse_date(raw)?.to_string()
    } else {
        current.date
    };
    let next_due_date = if body.next_due_date.is_some() {
        optional_date(body.next_due_date.as_deref())?
    } else {
        current.next_due_date
    };
    let note = if body.note.is_some() {
        encrypt_note(&state.crypto, body.note.as_deref())?
    } else {
        current.note_encrypted
    };
    sqlx::query(
        "UPDATE pet_health_records
         SET type = ?, date = ?, next_due_date = ?, note_encrypted = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&type_name)
    .bind(&date)
    .bind(&next_due_date)
    .bind(&note)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    sync_due_job(&state, &user.user_id, &row).await?;
    Ok(Json(row.public(&state.crypto)))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let row = load_one(&state, &user.user_id, &id).await?;
    cancel_jobs_like(&state, &user.user_id, "pet.due", &row.id).await?;
    sqlx::query("DELETE FROM pet_health_records WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, RecordRow>(&format!(
        "{RECORD_SELECT} WHERE user_id = ? ORDER BY date DESC, id"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(&state.crypto)).collect())
}

pub async fn upcoming_dues(
    state: &AppState,
    user_id: &str,
    pet_id: &str,
    today: NaiveDate,
) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, RecordRow>(&format!(
        "{RECORD_SELECT} WHERE user_id = ? AND pet_id = ? AND next_due_date IS NOT NULL
         ORDER BY next_due_date, id"
    ))
    .bind(user_id)
    .bind(pet_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows
        .into_iter()
        .filter(|row| {
            row.next_due_date
                .as_deref()
                .and_then(|raw| parse_date(raw).ok())
                .is_some_and(|due| due <= today + chrono::Duration::days(14))
        })
        .map(|row| row.public(&state.crypto))
        .collect())
}
