use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{NaiveDate, Utc};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    current_streak, local_date, parse_date, require_name, require_target_days, require_timezone,
    CheckinBody, CreateChallengeBody, DISCLAIMER,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct ChallengeRow {
    id: String,
    name: String,
    target_days: i64,
    start_date: String,
    timezone: String,
    created_at: String,
}

#[derive(FromRow)]
struct CheckinRow {
    id: String,
    challenge_id: String,
    day: String,
    created_at: String,
}

impl ChallengeRow {
    fn public(&self, days: &[NaiveDate], today: NaiveDate, checkins: &[CheckinRow]) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "target_days": self.target_days,
            "start_date": self.start_date,
            "timezone": self.timezone,
            "current_streak": current_streak(days, today),
            "progress_days": days.len() as i64,
            "checked_in_today": days.contains(&today),
            "checkins": checkins.iter().map(checkin_public).collect::<Vec<_>>(),
            "created_at": self.created_at,
            "disclaimer": DISCLAIMER,
        })
    }
}

fn checkin_public(row: &CheckinRow) -> Value {
    json!({
        "id": row.id,
        "challenge_id": row.challenge_id,
        "day": row.day,
        "created_at": row.created_at,
    })
}

async fn load_checkins(state: &AppState, challenge_id: &str) -> Result<Vec<CheckinRow>, AppError> {
    sqlx::query_as(
        "SELECT id, challenge_id, day, created_at FROM study_checkins
         WHERE challenge_id = ? ORDER BY day",
    )
    .bind(challenge_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

fn days_of(rows: &[CheckinRow]) -> Result<Vec<NaiveDate>, AppError> {
    rows.iter().map(|row| parse_date(&row.day)).collect()
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<ChallengeRow, AppError> {
    sqlx::query_as::<_, ChallengeRow>(
        "SELECT id, name, target_days, start_date, timezone, created_at
         FROM study_challenges WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn public_of(state: &AppState, row: &ChallengeRow) -> Result<Value, AppError> {
    let checkins = load_checkins(state, &row.id).await?;
    let days = days_of(&checkins)?;
    let today = local_date(&row.timezone, Utc::now());
    Ok(row.public(&days, today, &checkins))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, ChallengeRow>(
        "SELECT id, name, target_days, start_date, timezone, created_at
         FROM study_challenges WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(public_of(state, &row).await?);
    }
    Ok(out)
}

pub async fn today_rows(
    state: &AppState,
    user_id: &str,
    _date: &str,
) -> Result<Vec<Value>, AppError> {
    export_rows(state, user_id).await
}

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_rows(&state, &user.user_id).await?,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateChallengeBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let name = require_name(&body.name)?;
    let target = require_target_days(body.target_days)?;
    let timezone = require_timezone(body.timezone.as_deref());
    let start = match body.start_date.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => local_date(&timezone, Utc::now()).to_string(),
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO study_challenges (id, user_id, name, target_days, start_date, timezone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&name)
    .bind(target)
    .bind(start)
    .bind(&timezone)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(public_of(&state, &row).await?)))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = load_one(&state, &user.user_id, &id).await?;
    Ok(Json(public_of(&state, &row).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM study_challenges WHERE id = ? AND user_id = ?")
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
        None => local_date(&challenge.timezone, Utc::now()).to_string(),
    };
    if let Some(existing) = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, challenge_id, day, created_at FROM study_checkins
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
        "INSERT INTO study_checkins (id, challenge_id, user_id, day, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&checkin_id)
    .bind(&challenge.id)
    .bind(&user.user_id)
    .bind(&day)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, challenge_id, day, created_at FROM study_checkins WHERE id = ?",
    )
    .bind(checkin_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(checkin_public(&row))))
}
