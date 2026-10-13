use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::schedule::{next_occurrence, parse_hhmm, validate_days};
use super::{
    authorize_elder_access, cancel_reminder_jobs, enqueue_job, write_activity, ElderPerm,
    MISS_GRACE_MINUTES,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
pub struct ReminderRow {
    pub id: String,
    pub elder_user_id: String,
    pub created_by_user_id: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub time_local: String,
    pub days_of_week: String,
    pub timezone: String,
    pub voice_text: Option<String>,
    pub active: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ReminderPublic {
    pub id: String,
    pub elder_user_id: String,
    pub created_by_user_id: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub time: String,
    pub days_of_week: Vec<u8>,
    pub timezone: String,
    pub voice_text: Option<String>,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl ReminderRow {
    pub fn public(&self) -> ReminderPublic {
        ReminderPublic {
            id: self.id.clone(),
            elder_user_id: self.elder_user_id.clone(),
            created_by_user_id: self.created_by_user_id.clone(),
            title: self.title.clone(),
            body: self.body.clone(),
            kind: self.kind.clone(),
            time: self.time_local.clone(),
            days_of_week: serde_json::from_str(&self.days_of_week).unwrap_or_default(),
            timezone: self.timezone.clone(),
            voice_text: self.voice_text.clone(),
            active: self.active != 0,
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

#[derive(Deserialize)]
pub struct CreateReminderBody {
    pub title: String,
    pub body: String,
    pub kind: String,
    pub time: Option<String>,
    pub days_of_week: Option<Vec<u8>>,
    pub timezone: Option<String>,
    pub voice_text: Option<String>,
    pub schedule_cron: Option<String>,
}

#[derive(Deserialize)]
pub struct PatchReminderBody {
    pub title: Option<String>,
    pub body: Option<String>,
    pub kind: Option<String>,
    pub time: Option<String>,
    pub days_of_week: Option<Vec<u8>>,
    pub timezone: Option<String>,
    pub voice_text: Option<String>,
    pub active: Option<bool>,
    pub schedule_cron: Option<String>,
}

#[derive(Deserialize)]
pub struct AckBody {
    pub occurrence_at: String,
}

fn require_kind(kind: &str) -> Result<String, AppError> {
    match kind.trim() {
        "medication" | "general" => Ok(kind.trim().to_string()),
        _ => Err(AppError::InvalidRequest(
            "kind must be medication or general".into(),
        )),
    }
}

async fn load_reminder(state: &AppState, id: &str) -> Result<ReminderRow, AppError> {
    sqlx::query_as::<_, ReminderRow>(
        "SELECT id, elder_user_id, created_by_user_id, title, body, kind, time_local, days_of_week,
                timezone, voice_text, active, created_at, updated_at
         FROM elder_reminders WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn list_reminder_rows(
    state: &AppState,
    elder_id: &str,
) -> Result<Vec<ReminderPublic>, AppError> {
    let rows = sqlx::query_as::<_, ReminderRow>(
        "SELECT id, elder_user_id, created_by_user_id, title, body, kind, time_local, days_of_week,
                timezone, voice_text, active, created_at, updated_at
         FROM elder_reminders WHERE elder_user_id = ? ORDER BY time_local ASC",
    )
    .bind(elder_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(ReminderRow::public).collect())
}

#[derive(FromRow, Serialize)]
pub struct EventRow {
    pub id: String,
    pub reminder_id: String,
    pub elder_user_id: String,
    pub occurrence_at: String,
    pub status: String,
    pub acked_at: Option<String>,
}

pub async fn due_events(state: &AppState, elder_id: &str) -> Result<Vec<EventRow>, AppError> {
    sqlx::query_as::<_, EventRow>(
        "SELECT id, reminder_id, elder_user_id, occurrence_at, status, acked_at
         FROM elder_reminder_events
         WHERE elder_user_id = ? AND status IN ('scheduled', 'delivered') AND occurrence_at <= ?
         ORDER BY occurrence_at ASC",
    )
    .bind(elder_id)
    .bind(now_rfc3339())
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn schedule_next(
    state: &AppState,
    reminder: &ReminderRow,
    from: chrono::DateTime<Utc>,
) -> Result<(), AppError> {
    if reminder.active == 0 {
        return Ok(());
    }
    let days: Vec<u8> = serde_json::from_str(&reminder.days_of_week).unwrap_or_default();
    let when = next_occurrence(&reminder.time_local, &days, &reminder.timezone, from)?;
    let occurrence = when.to_rfc3339_opts(SecondsFormat::Secs, true);
    let miss_at =
        (when + Duration::minutes(MISS_GRACE_MINUTES)).to_rfc3339_opts(SecondsFormat::Secs, true);
    sqlx::query(
        "INSERT INTO elder_reminder_events
            (id, reminder_id, elder_user_id, occurrence_at, status, created_at)
         VALUES (?, ?, ?, ?, 'scheduled', ?)
         ON CONFLICT (reminder_id, occurrence_at) DO NOTHING",
    )
    .bind(new_id())
    .bind(&reminder.id)
    .bind(&reminder.elder_user_id)
    .bind(&occurrence)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    enqueue_job(
        state,
        &reminder.elder_user_id,
        &occurrence,
        &json!({
            "type": "elder_reminder",
            "reminder_id": reminder.id,
            "occurrence_at": occurrence,
            "title": reminder.title,
            "body": reminder.body,
            "voice_text": reminder.voice_text,
        }),
    )
    .await?;
    enqueue_job(
        state,
        &reminder.elder_user_id,
        &miss_at,
        &json!({
            "type": "elder_miss_check",
            "reminder_id": reminder.id,
            "occurrence_at": occurrence,
            "title": reminder.title,
        }),
    )
    .await?;
    Ok(())
}

pub async fn list_reminders(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let items = list_reminder_rows(&state, &elder_id).await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn create_reminder(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
    Json(body): Json<CreateReminderBody>,
) -> Result<(StatusCode, Json<ReminderPublic>), AppError> {
    if body.schedule_cron.is_some() {
        return Err(AppError::InvalidRequest(
            "reminders use time plus weekdays, not cron".into(),
        ));
    }
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let time = body
        .time
        .as_deref()
        .ok_or_else(|| AppError::InvalidRequest("time and days_of_week are required".into()))?;
    parse_hhmm(time)?;
    let days = validate_days(body.days_of_week.as_deref().unwrap_or(&[]))?;
    let kind = require_kind(&body.kind)?;
    let title = body.title.trim();
    let body_text = body.body.trim();
    if title.is_empty() || body_text.is_empty() {
        return Err(AppError::InvalidRequest(
            "title and body are required".into(),
        ));
    }
    let timezone = body
        .timezone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Asia/Shanghai");
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO elder_reminders
            (id, elder_user_id, created_by_user_id, title, body, kind, time_local, days_of_week,
             timezone, voice_text, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&elder_id)
    .bind(&user.user_id)
    .bind(title)
    .bind(body_text)
    .bind(&kind)
    .bind(time)
    .bind(serde_json::to_string(&days).unwrap_or_else(|_| "[]".into()))
    .bind(timezone)
    .bind(&body.voice_text)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_reminder(&state, &id).await?;
    schedule_next(&state, &row, Utc::now()).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn patch_reminder(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
    Json(body): Json<PatchReminderBody>,
) -> Result<Json<ReminderPublic>, AppError> {
    if body.schedule_cron.is_some() {
        return Err(AppError::InvalidRequest(
            "reminders use time plus weekdays, not cron".into(),
        ));
    }
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let current = load_reminder(&state, &id).await?;
    if current.elder_user_id != elder_id {
        return Err(AppError::NotFound);
    }
    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.title);
    let text = body
        .body
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.body);
    let kind = if let Some(kind) = body.kind.as_deref() {
        require_kind(kind)?
    } else {
        current.kind.clone()
    };
    let time = body.time.as_deref().unwrap_or(&current.time_local);
    parse_hhmm(time)?;
    let days = if let Some(days) = body.days_of_week.as_deref() {
        validate_days(days)?
    } else {
        serde_json::from_str(&current.days_of_week).unwrap_or_default()
    };
    let timezone = body
        .timezone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.timezone);
    let active = body.active.map(i64::from).unwrap_or(current.active);
    let voice = body.voice_text.as_ref().or(current.voice_text.as_ref());
    sqlx::query(
        "UPDATE elder_reminders
         SET title = ?, body = ?, kind = ?, time_local = ?, days_of_week = ?, timezone = ?,
             voice_text = ?, active = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(title)
    .bind(text)
    .bind(kind)
    .bind(time)
    .bind(serde_json::to_string(&days).unwrap_or_else(|_| "[]".into()))
    .bind(timezone)
    .bind(voice)
    .bind(active)
    .bind(now_rfc3339())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    cancel_reminder_jobs(&state, &elder_id, &id).await?;
    let row = load_reminder(&state, &id).await?;
    schedule_next(&state, &row, Utc::now()).await?;
    Ok(Json(row.public()))
}

pub async fn delete_reminder(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    cancel_reminder_jobs(&state, &elder_id, &id).await?;
    let result = sqlx::query("DELETE FROM elder_reminders WHERE id = ? AND elder_user_id = ?")
        .bind(id)
        .bind(elder_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ack_reminder(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
    Json(body): Json<AckBody>,
) -> Result<Json<EventRow>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let reminder = load_reminder(&state, &id).await?;
    if reminder.elder_user_id != elder_id {
        return Err(AppError::NotFound);
    }
    let occurrence = chrono::DateTime::parse_from_rfc3339(body.occurrence_at.trim())
        .map_err(|_| AppError::InvalidRequest("occurrence_at must be RFC3339".into()))?
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO elder_reminder_events
            (id, reminder_id, elder_user_id, occurrence_at, status, acked_at, created_at)
         VALUES (?, ?, ?, ?, 'acked', ?, ?)
         ON CONFLICT (reminder_id, occurrence_at) DO UPDATE SET
            status = 'acked',
            acked_at = excluded.acked_at",
    )
    .bind(new_id())
    .bind(&id)
    .bind(&elder_id)
    .bind(&occurrence)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    write_activity(
        &state,
        &elder_id,
        "reminder_acked",
        json!({ "reminder_id": id, "occurrence_at": occurrence }),
    )
    .await?;
    let row = sqlx::query_as::<_, EventRow>(
        "SELECT id, reminder_id, elder_user_id, occurrence_at, status, acked_at
         FROM elder_reminder_events WHERE reminder_id = ? AND occurrence_at = ?",
    )
    .bind(&id)
    .bind(&occurrence)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(row))
}

pub async fn on_reminder_delivered(
    state: &AppState,
    _user_id: &str,
    payload: &Value,
) -> Result<(), AppError> {
    let Some(reminder_id) = payload.get("reminder_id").and_then(Value::as_str) else {
        return Ok(());
    };
    let Some(occurrence) = payload.get("occurrence_at").and_then(Value::as_str) else {
        return Ok(());
    };
    sqlx::query(
        "UPDATE elder_reminder_events SET status = 'delivered'
         WHERE reminder_id = ? AND occurrence_at = ? AND status = 'scheduled'",
    )
    .bind(reminder_id)
    .bind(occurrence)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if let Ok(row) = load_reminder(state, reminder_id).await {
        if let Ok(when) = chrono::DateTime::parse_from_rfc3339(occurrence) {
            let _ = schedule_next(state, &row, when.with_timezone(&Utc)).await;
        }
    }
    Ok(())
}

pub async fn on_miss_check(state: &AppState, payload: &Value) -> Result<(), AppError> {
    let Some(reminder_id) = payload.get("reminder_id").and_then(Value::as_str) else {
        return Ok(());
    };
    let Some(occurrence) = payload.get("occurrence_at").and_then(Value::as_str) else {
        return Ok(());
    };
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status FROM elder_reminder_events WHERE reminder_id = ? AND occurrence_at = ?",
    )
    .bind(reminder_id)
    .bind(occurrence)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if status.as_deref() == Some("acked") {
        return Ok(());
    }
    let reminder = match load_reminder(state, reminder_id).await {
        Ok(row) => row,
        Err(_) => return Ok(()),
    };
    sqlx::query(
        "UPDATE elder_reminder_events SET status = 'missed'
         WHERE reminder_id = ? AND occurrence_at = ? AND status != 'acked'",
    )
    .bind(reminder_id)
    .bind(occurrence)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let caregivers: Vec<(String,)> =
        sqlx::query_as("SELECT caregiver_user_id FROM caregiver_links WHERE dependent_user_id = ?")
            .bind(&reminder.elder_user_id)
            .fetch_all(&state.pool)
            .await
            .map_err(map_sqlx)?;
    let now = now_rfc3339();
    let body = format!("可能错过用药提醒：{}（{}）", reminder.title, occurrence);
    for (caregiver,) in caregivers {
        sqlx::query(
            "INSERT INTO elder_notices
                (id, caregiver_user_id, elder_user_id, kind, body, created_at)
             VALUES (?, ?, ?, 'missed_dose', ?, ?)",
        )
        .bind(new_id())
        .bind(&caregiver)
        .bind(&reminder.elder_user_id)
        .bind(&body)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        sqlx::query(
            "INSERT INTO elder_sms_log
                (id, to_user_id, elder_user_id, purpose, body, created_at)
             VALUES (?, ?, ?, 'missed_dose', ?, ?)",
        )
        .bind(new_id())
        .bind(&caregiver)
        .bind(&reminder.elder_user_id)
        .bind(&body)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        let _ = state
            .push
            .send(&crate::push::PushMessage {
                user_id: caregiver,
                job_id: new_id(),
                payload: json!({
                    "type": "elder_missed_dose",
                    "reminder_id": reminder_id,
                    "occurrence_at": occurrence,
                    "title": reminder.title,
                }),
            })
            .await;
    }
    Ok(())
}
