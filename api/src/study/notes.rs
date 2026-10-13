use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{decrypt_text, encrypt_text, CreateNoteBody, NotesQuery, PatchNoteBody, DISCLAIMER};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct NoteRow {
    id: String,
    title: String,
    content_md_encrypted: Option<Vec<u8>>,
    tags: String,
    created_at: String,
    updated_at: String,
}

impl NoteRow {
    fn public(&self, state: &AppState) -> Value {
        json!({
            "id": self.id,
            "title": self.title,
            "content_md": decrypt_text(&state.crypto, self.content_md_encrypted.as_deref()).unwrap_or_default(),
            "tags": serde_json::from_str::<Vec<String>>(&self.tags).unwrap_or_default(),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const SELECT: &str =
    "SELECT id, title, content_md_encrypted, tags, created_at, updated_at FROM study_notes";

fn require_title(raw: &str) -> Result<String, AppError> {
    let title = raw.trim();
    if title.is_empty() || title.chars().count() > 80 {
        return Err(AppError::InvalidRequest("title is invalid".into()));
    }
    Ok(title.to_string())
}

fn encode_tags(tags: Option<&[String]>) -> Result<String, AppError> {
    let mut clean = Vec::new();
    for tag in tags.unwrap_or(&[]) {
        let t = tag.trim();
        if t.is_empty() {
            continue;
        }
        if t.chars().count() > 24 {
            return Err(AppError::InvalidRequest(
                "each tag must be at most 24 characters".into(),
            ));
        }
        if !clean.iter().any(|item: &String| item == t) {
            clean.push(t.to_string());
        }
        if clean.len() > 16 {
            return Err(AppError::InvalidRequest("too many tags".into()));
        }
    }
    serde_json::to_string(&clean).map_err(|_| AppError::InvalidRequest("tags is invalid".into()))
}

fn like_pattern(q: &str) -> String {
    let safe: String = q
        .chars()
        .filter(|c| *c != '%' && *c != '_' && *c != '\\')
        .collect();
    format!("%{safe}%")
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<NoteRow, AppError> {
    sqlx::query_as::<_, NoteRow>(&format!("{SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, NoteRow>(&format!(
        "{SELECT} WHERE user_id = ? ORDER BY updated_at DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(state)).collect())
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<NotesQuery>,
) -> Result<Json<Value>, AppError> {
    let rows = if let Some(q) = query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let pattern = like_pattern(q);
        sqlx::query_as::<_, NoteRow>(&format!(
            "{SELECT} WHERE user_id = ? AND (title LIKE ? OR tags LIKE ?)
             ORDER BY updated_at DESC"
        ))
        .bind(&user.user_id)
        .bind(&pattern)
        .bind(&pattern)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    } else {
        sqlx::query_as::<_, NoteRow>(&format!(
            "{SELECT} WHERE user_id = ? ORDER BY updated_at DESC"
        ))
        .bind(&user.user_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    };
    Ok(Json(json!({
        "items": rows.iter().map(|row| row.public(&state)).collect::<Vec<_>>(),
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateNoteBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let title = require_title(&body.title)?;
    let content = encrypt_text(
        &state.crypto,
        body.content_md.as_deref(),
        20_000,
        "content_md",
    )?;
    let tags = encode_tags(body.tags.as_deref())?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO study_notes (id, user_id, title, content_md_encrypted, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&title)
    .bind(&content)
    .bind(&tags)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(load_one(&state, &user.user_id, &id).await?.public(&state)),
    ))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(
        load_one(&state, &user.user_id, &id).await?.public(&state),
    ))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchNoteBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let title = match body.title.as_deref() {
        Some(raw) => require_title(raw)?,
        None => current.title.clone(),
    };
    let content = if body.content_md.is_some() {
        encrypt_text(
            &state.crypto,
            body.content_md.as_deref(),
            20_000,
            "content_md",
        )?
    } else {
        current.content_md_encrypted.clone()
    };
    let tags = match body.tags.as_deref() {
        Some(raw) => encode_tags(Some(raw))?,
        None => current.tags.clone(),
    };
    sqlx::query(
        "UPDATE study_notes SET title = ?, content_md_encrypted = ?, tags = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&title)
    .bind(&content)
    .bind(&tags)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(
        load_one(&state, &user.user_id, &id).await?.public(&state),
    ))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM study_notes WHERE id = ? AND user_id = ?")
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
