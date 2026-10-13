use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{SecondsFormat, Utc};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    ensure_goals, expand_interval, CreateReminderBody, PatchReminderBody, DEFAULT_INTERVAL_HOURS,
    DEFAULT_WINDOW_END, DEFAULT_WINDOW_START, DISCLAIMER,
};
use crate::auth::AuthUser;
use crate::elder::{next_occurrence, parse_hhmm, validate_days};
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow, Clone)]
struct ReminderRow {
    id: String,
    user_id: String,
    kind: String,
    time_local: String,
    days_of_week: String,
    timezone: String,
    active: i64,
    reminder_job_id: Option<String>,
    created_at: String,
    updated_at: String,
}

impl ReminderRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "kind": self.kind,
            "time": self.time_local,
            "days_of_week": serde_json::from_str::<Vec<u8>>(&self.days_of_week).unwrap_or_default(),
            "timezone": self.timezone,
            "active": self.active != 0,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const SELECT: &str = "SELECT id, user_id, kind, time_local, days_of_week, timezone, active,
        reminder_job_id, created_at, updated_at FROM well_reminders";

fn require_kind(raw: &str) -> Result<String, AppError> {
    match raw.trim() {
        "water" | "sleep" | "plan" => Ok(raw.trim().to_string()),
        _ => Err(AppError::InvalidRequest(
            "kind must be water, sleep or plan".into(),
        )),
    }
}

fn require_timezone(raw: Option<&str>) -> String {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some("UTC" | "Etc/UTC" | "Z") => "UTC".into(),
        _ => "Asia/Shanghai".into(),
    }
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<ReminderRow, AppError> {
    sqlx::query_as::<_, ReminderRow>(&format!("{SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

async fn load_user(state: &AppState, user_id: &str) -> Result<Vec<ReminderRow>, AppError> {
    sqlx::query_as::<_, ReminderRow>(&format!(
        "{SELECT} WHERE user_id = ? ORDER BY kind, time_local"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(load_user(state, user_id)
        .await?
        .iter()
        .map(ReminderRow::public)
        .collect())
}

pub async fn ensure_defaults(state: &AppState, user_id: &str) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM well_reminders WHERE user_id = ? AND kind = 'water'",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if count > 0 {
        return Ok(());
    }
    insert_times(
        state,
        user_id,
        "water",
        &expand_interval(
            DEFAULT_WINDOW_START,
            DEFAULT_WINDOW_END,
            DEFAULT_INTERVAL_HOURS,
        )?,
        &[1, 2, 3, 4, 5, 6, 7],
        "Asia/Shanghai",
        true,
    )
    .await?;
    Ok(())
}

async fn insert_times(
    state: &AppState,
    user_id: &str,
    kind: &str,
    times: &[String],
    days: &[u8],
    timezone: &str,
    active: bool,
) -> Result<Vec<ReminderRow>, AppError> {
    let days_json = serde_json::to_string(&validate_days(days)?)
        .map_err(|_| AppError::InvalidRequest("days_of_week is invalid".into()))?;
    let now = now_rfc3339();
    let mut created = Vec::new();
    for time in times {
        parse_hhmm(time)?;
        let id = new_id();
        sqlx::query(
            "INSERT INTO well_reminders
                (id, user_id, kind, time_local, days_of_week, timezone, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(kind)
        .bind(time)
        .bind(&days_json)
        .bind(timezone)
        .bind(i64::from(active))
        .bind(&now)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        sync_job(state, &id).await?;
        created.push(load_one(state, user_id, &id).await?);
    }
    Ok(created)
}

async fn cancel_kind(state: &AppState, user_id: &str, kind: &str) -> Result<(), AppError> {
    let rows =
        sqlx::query_as::<_, ReminderRow>(&format!("{SELECT} WHERE user_id = ? AND kind = ?"))
            .bind(user_id)
            .bind(kind)
            .fetch_all(&state.pool)
            .await
            .map_err(map_sqlx)?;
    for row in rows {
        if let Some(job_id) = &row.reminder_job_id {
            cancel_job(state, job_id).await?;
        }
    }
    sqlx::query("DELETE FROM well_reminders WHERE user_id = ? AND kind = ?")
        .bind(user_id)
        .bind(kind)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(())
}

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    ensure_goals(&state, &user.user_id).await?;
    ensure_defaults(&state, &user.user_id).await?;
    maintain_user(&state, &user.user_id).await?;
    Ok(Json(json!({
        "items": export_rows(&state, &user.user_id).await?,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateReminderBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    ensure_goals(&state, &user.user_id).await?;
    let kind = require_kind(body.kind.as_deref().unwrap_or("water"))?;
    let days = body
        .days_of_week
        .unwrap_or_else(|| vec![1, 2, 3, 4, 5, 6, 7]);
    let timezone = require_timezone(body.timezone.as_deref());
    let active = body.active.unwrap_or(true);
    if let Some(hours) = body.interval_hours {
        let start = body.window_start.as_deref().unwrap_or(DEFAULT_WINDOW_START);
        let end = body.window_end.as_deref().unwrap_or(DEFAULT_WINDOW_END);
        let times = expand_interval(start, end, hours)?;
        cancel_kind(&state, &user.user_id, &kind).await?;
        let rows = insert_times(
            &state,
            &user.user_id,
            &kind,
            &times,
            &days,
            &timezone,
            active,
        )
        .await?;
        return Ok((
            StatusCode::CREATED,
            Json(json!({
                "items": rows.iter().map(ReminderRow::public).collect::<Vec<_>>(),
                "disclaimer": DISCLAIMER,
            })),
        ));
    }
    let time = body.time_local.as_deref().ok_or_else(|| {
        AppError::InvalidRequest("time_local or interval_hours is required".into())
    })?;
    parse_hhmm(time)?;
    let rows = insert_times(
        &state,
        &user.user_id,
        &kind,
        &[time.to_string()],
        &days,
        &timezone,
        active,
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(rows.into_iter().next().expect("one reminder").public()),
    ))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchReminderBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let time = body.time_local.as_deref().unwrap_or(&current.time_local);
    parse_hhmm(time)?;
    let days = match body.days_of_week.as_deref() {
        Some(raw) => validate_days(raw)?,
        None => serde_json::from_str(&current.days_of_week)
            .unwrap_or_else(|_| vec![1, 2, 3, 4, 5, 6, 7]),
    };
    let timezone = require_timezone(body.timezone.as_deref().or(Some(&current.timezone)));
    let active = body.active.unwrap_or(current.active != 0);
    sqlx::query(
        "UPDATE well_reminders
         SET time_local = ?, days_of_week = ?, timezone = ?, active = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(time)
    .bind(serde_json::to_string(&days).unwrap_or_else(|_| current.days_of_week.clone()))
    .bind(timezone)
    .bind(i64::from(active))
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sync_job(&state, &id).await?;
    Ok(Json(load_one(&state, &user.user_id, &id).await?.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    if let Some(job_id) = current.reminder_job_id {
        cancel_job(&state, &job_id).await?;
    }
    sqlx::query("DELETE FROM well_reminders WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn maintain_all(state: &AppState) -> Result<(), AppError> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT DISTINCT user_id FROM well_reminders")
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?;
    for user_id in ids {
        maintain_user(state, &user_id).await?;
    }
    Ok(())
}

pub async fn maintain_user(state: &AppState, user_id: &str) -> Result<(), AppError> {
    for row in load_user(state, user_id).await? {
        sync_job(state, &row.id).await?;
    }
    Ok(())
}

async fn sync_job(state: &AppState, reminder_id: &str) -> Result<(), AppError> {
    let row = sqlx::query_as::<_, ReminderRow>(&format!("{SELECT} WHERE id = ?"))
        .bind(reminder_id)
        .fetch_one(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if row.active == 0 {
        if let Some(job_id) = &row.reminder_job_id {
            cancel_job(state, job_id).await?;
        }
        sqlx::query("UPDATE well_reminders SET reminder_job_id = NULL WHERE id = ?")
            .bind(reminder_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
        return Ok(());
    }
    if let Some(job_id) = &row.reminder_job_id {
        if let Some(status) = job_status(state, job_id).await? {
            if status == "pending" {
                return Ok(());
            }
        }
    }
    let days: Vec<u8> = serde_json::from_str(&row.days_of_week).unwrap_or_default();
    let when = next_occurrence(&row.time_local, &days, &row.timezone, Utc::now())?;
    let run_at = when.to_rfc3339_opts(SecondsFormat::Secs, true);
    let job_id = new_id();
    let payload = json!({
        "type": format!("wellness.{}", row.kind),
        "source": "wellness_reminder",
        "reminder_id": row.id,
        "kind": row.kind,
        "title": reminder_title(&row.kind),
        "body": reminder_body(&row.kind),
    });
    sqlx::query(
        "INSERT INTO scheduled_jobs
            (id, user_id, kind, payload_json, run_at, status, attempts, created_at)
         VALUES (?, ?, 'web_push', ?, ?, 'pending', 0, ?)",
    )
    .bind(&job_id)
    .bind(&row.user_id)
    .bind(payload.to_string())
    .bind(&run_at)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sqlx::query("UPDATE well_reminders SET reminder_job_id = ? WHERE id = ?")
        .bind(&job_id)
        .bind(reminder_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(())
}

fn reminder_title(kind: &str) -> &'static str {
    match kind {
        "sleep" => "睡眠打卡提醒",
        "plan" => "健康计划提醒",
        _ => "喝水提醒",
    }
}

fn reminder_body(kind: &str) -> &'static str {
    match kind {
        "sleep" => "记下昨晚的睡眠，仅供自己参考。",
        "plan" => "今日计划可以打卡了。",
        _ => "该喝水了，记一杯保持进度。",
    }
}

async fn job_status(state: &AppState, job_id: &str) -> Result<Option<String>, AppError> {
    sqlx::query_scalar("SELECT status FROM scheduled_jobs WHERE id = ?")
        .bind(job_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)
}

async fn cancel_job(state: &AppState, job_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE scheduled_jobs SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
    )
    .bind(job_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}
