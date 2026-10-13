use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    cancel_jobs_like, enqueue_job, owned_pet, require_care_kind, CreateReminderBody,
    PatchReminderBody, DEFAULT_TZ, DISCLAIMER,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct ReminderRow {
    id: String,
    pet_id: String,
    kind: String,
    time_local: String,
    days_of_week: String,
    timezone: String,
    active: i64,
    created_at: String,
    updated_at: String,
}

impl ReminderRow {
    fn days(&self) -> Result<Vec<u8>, AppError> {
        serde_json::from_str(&self.days_of_week)
            .map_err(|_| AppError::InvalidRequest("days_of_week is invalid".into()))
    }

    fn public(&self) -> Result<Value, AppError> {
        Ok(json!({
            "id": self.id,
            "pet_id": self.pet_id,
            "kind": self.kind,
            "time_local": self.time_local,
            "days_of_week": self.days()?,
            "timezone": self.timezone,
            "active": self.active != 0,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }))
    }
}

const REMINDER_SELECT: &str = "SELECT id, pet_id, kind, time_local, days_of_week, timezone,
        active, created_at, updated_at FROM pet_reminders";

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<ReminderRow, AppError> {
    sqlx::query_as::<_, ReminderRow>(&format!("{REMINDER_SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

async fn enqueue_care(state: &AppState, user_id: &str, row: &ReminderRow) -> Result<(), AppError> {
    cancel_jobs_like(state, user_id, "pet.care", &row.id).await?;
    if row.active == 0 {
        return Ok(());
    }
    let days = crate::elder::validate_days(&row.days()?)?;
    let next = crate::elder::next_occurrence(&row.time_local, &days, &row.timezone, Utc::now())?;
    let run_at = next.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let payload = json!({
        "type": "pet.care",
        "pet_id": row.pet_id,
        "reminder_id": row.id,
        "kind": row.kind,
        "title": "宠物日常提醒",
        "body": format!("该给毛孩子{}了", care_label(&row.kind)),
        "disclaimer": DISCLAIMER,
    });
    enqueue_job(state, user_id, "pet.care", &run_at, &payload).await?;
    Ok(())
}

fn care_label(kind: &str) -> &'static str {
    match kind {
        "feed" => "喂食",
        "walk" => "遛弯",
        "groom" => "梳毛",
        "litter" => "铲屎",
        _ => "照护",
    }
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let rows = sqlx::query_as::<_, ReminderRow>(&format!(
        "{REMINDER_SELECT} WHERE user_id = ? AND pet_id = ? ORDER BY created_at"
    ))
    .bind(&user.user_id)
    .bind(&pet_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row.public()?);
    }
    Ok(Json(json!({ "items": items })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Path(pet_id): Path<String>,
    Json(body): Json<CreateReminderBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    owned_pet(&state, &user.user_id, &pet_id).await?;
    let kind = require_care_kind(&body.kind)?;
    crate::elder::parse_hhmm(&body.time_local)?;
    let days = crate::elder::validate_days(&body.days_of_week)?;
    let timezone = body
        .timezone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_TZ);
    let _ = crate::elder::tz_offset(timezone);
    let active = body.active.unwrap_or(true);
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO pet_reminders
            (id, pet_id, user_id, kind, time_local, days_of_week, timezone, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&pet_id)
    .bind(&user.user_id)
    .bind(kind)
    .bind(&body.time_local)
    .bind(serde_json::to_string(&days).expect("days_of_week json"))
    .bind(timezone)
    .bind(i64::from(active))
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    enqueue_care(&state, &user.user_id, &row).await?;
    Ok((StatusCode::CREATED, Json(row.public()?)))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchReminderBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let days = if let Some(raw) = body.days_of_week.as_deref() {
        crate::elder::validate_days(raw)?
    } else {
        current.days()?
    };
    let kind = if let Some(raw) = body.kind.as_deref() {
        require_care_kind(raw)?.to_string()
    } else {
        current.kind.clone()
    };
    let time_local = if let Some(raw) = body.time_local.as_deref() {
        crate::elder::parse_hhmm(raw)?;
        raw.to_string()
    } else {
        current.time_local.clone()
    };
    let timezone = if let Some(raw) = body
        .timezone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let _ = crate::elder::tz_offset(raw);
        raw.to_string()
    } else {
        current.timezone
    };
    let active = body.active.map(i64::from).unwrap_or(current.active);
    sqlx::query(
        "UPDATE pet_reminders
         SET kind = ?, time_local = ?, days_of_week = ?, timezone = ?, active = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&kind)
    .bind(&time_local)
    .bind(serde_json::to_string(&days).expect("days_of_week json"))
    .bind(&timezone)
    .bind(active)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_one(&state, &user.user_id, &id).await?;
    enqueue_care(&state, &user.user_id, &row).await?;
    Ok(Json(row.public()?))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let row = load_one(&state, &user.user_id, &id).await?;
    cancel_jobs_like(&state, &user.user_id, "pet.care", &row.id).await?;
    sqlx::query("DELETE FROM pet_reminders WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, ReminderRow>(&format!(
        "{REMINDER_SELECT} WHERE user_id = ? ORDER BY created_at"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row.public()?);
    }
    Ok(items)
}

pub async fn requeue(state: &AppState, payload: &Value) -> Result<(), AppError> {
    let Some(reminder_id) = payload.get("reminder_id").and_then(Value::as_str) else {
        return Ok(());
    };
    let Some(user_id) =
        sqlx::query_scalar::<_, String>("SELECT user_id FROM pet_reminders WHERE id = ?")
            .bind(reminder_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(map_sqlx)?
    else {
        return Ok(());
    };
    let Ok(row) = load_one(state, &user_id, reminder_id).await else {
        return Ok(());
    };
    enqueue_care(state, &user_id, &row).await
}
