use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::review::{apply_grade, next_review_date, Grade, ReviewState, DEFAULT_EASE};
use super::{
    decrypt_text, local_date, require_encrypt, ClassifyBody, CreateCardBody, ReviewBody, DISCLAIMER,
};
use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct CardRow {
    id: String,
    front_encrypted: Vec<u8>,
    back_encrypted: Vec<u8>,
    category: Option<String>,
    ease: f64,
    interval_days: i64,
    next_review_date: String,
    created_at: String,
    updated_at: String,
}

impl CardRow {
    fn public(&self, state: &AppState) -> Value {
        json!({
            "id": self.id,
            "front": decrypt_text(&state.crypto, Some(&self.front_encrypted)),
            "back": decrypt_text(&state.crypto, Some(&self.back_encrypted)),
            "category": self.category,
            "ease": self.ease,
            "interval_days": self.interval_days,
            "next_review_date": self.next_review_date,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const SELECT: &str = "SELECT id, front_encrypted, back_encrypted, category, ease, interval_days,
        next_review_date, created_at, updated_at FROM study_flashcards";

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<CardRow, AppError> {
    sqlx::query_as::<_, CardRow>(&format!("{SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

fn require_category(raw: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(text) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if text.chars().count() > 32 {
        return Err(AppError::InvalidRequest(
            "category must be at most 32 characters".into(),
        ));
    }
    Ok(Some(text.to_string()))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, CardRow>(&format!(
        "{SELECT} WHERE user_id = ? ORDER BY created_at DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(state)).collect())
}

pub async fn due_count(state: &AppState, user_id: &str, date: &str) -> Result<i64, AppError> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM study_flashcards WHERE user_id = ? AND next_review_date <= ?",
    )
    .bind(user_id)
    .bind(date)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_rows(&state, &user.user_id).await?,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn due(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let today = local_date("Asia/Shanghai", Utc::now()).to_string();
    let rows = sqlx::query_as::<_, CardRow>(&format!(
        "{SELECT} WHERE user_id = ? AND next_review_date <= ? ORDER BY next_review_date"
    ))
    .bind(&user.user_id)
    .bind(&today)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.iter().map(|row| row.public(&state)).collect::<Vec<_>>(),
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateCardBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    if body
        .file_url
        .as_deref()
        .is_some_and(|s| !s.trim().is_empty())
    {
        return Err(AppError::InvalidRequest(
            "photo capture is not supported".into(),
        ));
    }
    let front = require_encrypt(&state.crypto, &body.front, 2000, "front")?;
    let back = require_encrypt(&state.crypto, &body.back, 2000, "back")?;
    let category = require_category(body.category.as_deref())?;
    let id = new_id();
    let now = now_rfc3339();
    let today = local_date("Asia/Shanghai", Utc::now()).to_string();
    sqlx::query(
        "INSERT INTO study_flashcards
            (id, user_id, front_encrypted, back_encrypted, category, ease, interval_days,
             next_review_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&front)
    .bind(&back)
    .bind(&category)
    .bind(DEFAULT_EASE)
    .bind(&today)
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

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM study_flashcards WHERE id = ? AND user_id = ?")
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

pub async fn review(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ReviewBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let grade = Grade::parse(&body.grade)?;
    let next = apply_grade(
        ReviewState {
            ease: current.ease,
            interval_days: current.interval_days,
        },
        grade,
    );
    let today = local_date("Asia/Shanghai", Utc::now());
    let next_date = next_review_date(today, next.interval_days).to_string();
    sqlx::query(
        "UPDATE study_flashcards
         SET ease = ?, interval_days = ?, next_review_date = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(next.ease)
    .bind(next.interval_days)
    .bind(&next_date)
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

pub async fn classify(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ClassifyBody>,
) -> Result<Json<Value>, AppError> {
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: format!(
                "Classify this flashcard into a short Chinese category. Front: {} Back: {}",
                body.front.trim(),
                body.back.trim()
            ),
        }],
        model: Some("qingxin-study-classify".into()),
    };
    let content = match state.ai.complete(&user.user_id, req).await {
        Ok(done) => done.content,
        Err(AiError::Unconfigured) => return Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => return Err(AppError::Unavailable(msg)),
    };
    let category = content
        .trim()
        .trim_matches(|c| c == '"' || c == '{' || c == '}')
        .split([':', ',', '\n'])
        .next_back()
        .unwrap_or(content.trim())
        .trim()
        .chars()
        .take(32)
        .collect::<String>();
    Ok(Json(json!({
        "category": category,
        "disclaimer": DISCLAIMER,
        "source": "ai_stub",
    })))
}
