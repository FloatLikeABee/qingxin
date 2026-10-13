use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{parse_date, shanghai_today, CheckinBody, CreateChallengeBody};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct ChallengeRow {
    id: String,
    name: String,
    target_days: i64,
    target_amount_fen: Option<i64>,
    start_date: String,
    created_at: String,
    progress_days: i64,
}

impl ChallengeRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "target_days": self.target_days,
            "target_amount_fen": self.target_amount_fen,
            "start_date": self.start_date,
            "progress_days": self.progress_days,
            "created_at": self.created_at,
        })
    }
}

#[derive(FromRow)]
struct CheckinRow {
    id: String,
    challenge_id: String,
    day: String,
    created_at: String,
}

const CHALLENGE_SELECT: &str =
    "SELECT c.id, c.name, c.target_days, c.target_amount_fen, c.start_date, c.created_at,
        (SELECT COUNT(*) FROM fin_challenge_checkins k WHERE k.challenge_id = c.id) AS progress_days
     FROM fin_savings_challenges c";

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(
        json!({ "items": export_rows(&state, &user.user_id).await? }),
    ))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateChallengeBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let name = body.name.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(AppError::InvalidRequest("name is invalid".into()));
    }
    if body.target_days <= 0 {
        return Err(AppError::InvalidRequest("target_days must be > 0".into()));
    }
    if let Some(amount) = body.target_amount_fen {
        super::require_fen(amount)?;
    }
    let start = match body.start_date.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => shanghai_today().to_string(),
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO fin_savings_challenges
            (id, user_id, name, target_days, target_amount_fen, start_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(name)
    .bind(body.target_days)
    .bind(body.target_amount_fen)
    .bind(start)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM fin_savings_challenges WHERE id = ? AND user_id = ?")
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

pub async fn checkin(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CheckinBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let challenge = load_one(&state, &user.user_id, &id).await?;
    let day = match body.day.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => shanghai_today().to_string(),
    };
    if let Some(existing) = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, challenge_id, day, created_at FROM fin_challenge_checkins
         WHERE challenge_id = ? AND day = ?",
    )
    .bind(&challenge.id)
    .bind(&day)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    {
        return Ok((StatusCode::OK, Json(checkin_public(&existing))));
    }
    let checkin_id = new_id();
    sqlx::query(
        "INSERT INTO fin_challenge_checkins (id, challenge_id, day, created_at)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&checkin_id)
    .bind(&challenge.id)
    .bind(&day)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, challenge_id, day, created_at FROM fin_challenge_checkins WHERE id = ?",
    )
    .bind(checkin_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(checkin_public(&row))))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let challenges = sqlx::query_as::<_, ChallengeRow>(&format!(
        "{CHALLENGE_SELECT} WHERE c.user_id = ? ORDER BY c.created_at DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut out = Vec::new();
    for challenge in challenges {
        let checkins: Vec<CheckinRow> = sqlx::query_as(
            "SELECT id, challenge_id, day, created_at FROM fin_challenge_checkins
             WHERE challenge_id = ? ORDER BY day",
        )
        .bind(&challenge.id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?;
        let mut value = challenge.public();
        value["checkins"] = json!(checkins.iter().map(checkin_public).collect::<Vec<_>>());
        out.push(value);
    }
    Ok(out)
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<ChallengeRow, AppError> {
    sqlx::query_as::<_, ChallengeRow>(&format!(
        "{CHALLENGE_SELECT} WHERE c.id = ? AND c.user_id = ?"
    ))
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

fn checkin_public(row: &CheckinRow) -> Value {
    json!({
        "id": row.id,
        "challenge_id": row.challenge_id,
        "day": row.day,
        "created_at": row.created_at,
    })
}
