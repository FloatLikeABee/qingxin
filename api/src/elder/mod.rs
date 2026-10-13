mod contacts;
mod content;
mod reminders;
mod schedule;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const REMINDER_DISCLAIMER: &str =
    "用药提醒不能替代闹钟或家人照看。浏览器通知可能被系统延迟或关闭，请不要只依赖本应用按时服药。";
pub const MEDICAL_DISCLAIMER: &str =
    "本模块为工具辅助与信息展示，不构成医疗建议。紧急情况请拨打 120 / 110。";
pub const MISS_GRACE_MINUTES: i64 = 60;

#[derive(Clone, Copy)]
pub enum ElderPerm {
    Manage,
    ViewLog,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/elder/today", get(today))
        .route("/v1/elder/notices", get(list_notices))
        .route("/v1/elder/ai/explain", post(ai_explain))
        .route("/v1/elder/fraud-scripts", get(content::list_fraud_scripts))
        .route(
            "/v1/elder/fraud-scripts/{id}",
            patch(content::patch_fraud_script),
        )
        .route("/v1/elder/number-flags", post(content::flag_number))
        .route("/v1/elder/number-flags/check", get(content::check_number))
        .route(
            "/v1/elder/tutorials/system",
            get(content::list_system_tutorials),
        )
        .route(
            "/v1/elder/{elder_id}/profile",
            get(get_profile).patch(patch_profile),
        )
        .route(
            "/v1/elder/{elder_id}/reminders",
            get(reminders::list_reminders).post(reminders::create_reminder),
        )
        .route(
            "/v1/elder/{elder_id}/reminders/{id}",
            patch(reminders::patch_reminder).delete(reminders::delete_reminder),
        )
        .route(
            "/v1/elder/{elder_id}/reminders/{id}/ack",
            post(reminders::ack_reminder),
        )
        .route(
            "/v1/elder/{elder_id}/contacts",
            get(contacts::list_contacts).post(contacts::create_contact),
        )
        .route(
            "/v1/elder/{elder_id}/contacts/{id}",
            patch(contacts::patch_contact).delete(contacts::delete_contact),
        )
        .route(
            "/v1/elder/{elder_id}/tutorials",
            get(content::list_family_tutorials).post(content::create_tutorial),
        )
        .route(
            "/v1/elder/{elder_id}/tutorials/{id}",
            patch(content::patch_tutorial).delete(content::delete_tutorial),
        )
        .route(
            "/v1/elder/{elder_id}/activity",
            get(list_activity).post(post_activity),
        )
        .route("/v1/elder/{elder_id}/sms-log", get(list_sms_log))
}

pub fn resolve_elder_id(raw: &str, caller: &str) -> String {
    if raw == "me" {
        caller.to_string()
    } else {
        raw.to_string()
    }
}

pub async fn is_linked(
    state: &AppState,
    caregiver: &str,
    dependent: &str,
) -> Result<bool, AppError> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM caregiver_links
         WHERE caregiver_user_id = ? AND dependent_user_id = ?",
    )
    .bind(caregiver)
    .bind(dependent)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(count > 0)
}

pub async fn ensure_profile(state: &AppState, user_id: &str) -> Result<(), AppError> {
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO elder_profiles (user_id, activity_log_opt_in, timezone, created_at, updated_at)
         VALUES (?, 0, 'Asia/Shanghai', ?, ?)
         ON CONFLICT (user_id) DO NOTHING",
    )
    .bind(user_id)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

pub async fn authorize_elder_access(
    state: &AppState,
    caller: &str,
    elder_id: &str,
    perm: ElderPerm,
) -> Result<String, AppError> {
    let elder_id = resolve_elder_id(elder_id, caller);
    let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE id = ?")
        .bind(&elder_id)
        .fetch_one(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if exists == 0 {
        return Err(AppError::NotFound);
    }
    ensure_profile(state, &elder_id).await?;
    if caller == elder_id {
        return Ok(elder_id);
    }
    if !is_linked(state, caller, &elder_id).await? {
        return Err(AppError::NotFound);
    }
    if matches!(perm, ElderPerm::ViewLog) {
        let opt_in = sqlx::query_scalar::<_, i64>(
            "SELECT activity_log_opt_in FROM elder_profiles WHERE user_id = ?",
        )
        .bind(&elder_id)
        .fetch_one(&state.pool)
        .await
        .map_err(map_sqlx)?;
        if opt_in == 0 {
            return Err(AppError::NotFound);
        }
    }
    Ok(elder_id)
}

pub async fn write_activity(
    state: &AppState,
    elder_user_id: &str,
    event_type: &str,
    payload: Value,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO elder_activity_log (id, elder_user_id, event_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(new_id())
    .bind(elder_user_id)
    .bind(event_type)
    .bind(payload.to_string())
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

pub async fn enqueue_job(
    state: &AppState,
    user_id: &str,
    run_at: &str,
    payload: &Value,
) -> Result<String, AppError> {
    let id = new_id();
    sqlx::query(
        "INSERT INTO scheduled_jobs
            (id, user_id, kind, payload_json, run_at, status, attempts, created_at)
         VALUES (?, ?, 'web_push', ?, ?, 'pending', 0, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(payload.to_string())
    .bind(run_at)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(id)
}

pub async fn cancel_reminder_jobs(
    state: &AppState,
    elder_user_id: &str,
    reminder_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE scheduled_jobs SET status = 'cancelled'
         WHERE user_id = ? AND status = 'pending' AND payload_json LIKE ?",
    )
    .bind(elder_user_id)
    .bind(format!("%{reminder_id}%"))
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

pub async fn after_job(
    state: &AppState,
    user_id: &str,
    _job_id: &str,
    payload: &Value,
) -> Result<(), AppError> {
    let Some(kind) = payload.get("type").and_then(Value::as_str) else {
        return Ok(());
    };
    match kind {
        "elder_reminder" => reminders::on_reminder_delivered(state, user_id, payload).await,
        "elder_miss_check" => reminders::on_miss_check(state, payload).await,
        _ => Ok(()),
    }
}

#[derive(Deserialize)]
struct TodayQuery {
    elder_id: Option<String>,
}

async fn today(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<TodayQuery>,
) -> Result<Json<Value>, AppError> {
    let raw = query.elder_id.as_deref().unwrap_or("me");
    let elder_id = authorize_elder_access(&state, &user.user_id, raw, ElderPerm::Manage).await?;
    let reminders = reminders::list_reminder_rows(&state, &elder_id).await?;
    let due = reminders::due_events(&state, &elder_id).await?;
    let contacts = contacts::contact_items(&state, &elder_id).await?;
    Ok(Json(json!({
        "elder_user_id": elder_id,
        "reminders": reminders,
        "due": due,
        "contacts": contacts,
        "disclaimer": REMINDER_DISCLAIMER,
        "medical_disclaimer": MEDICAL_DISCLAIMER,
    })))
}

#[derive(FromRow, Serialize)]
struct ProfileRow {
    user_id: String,
    activity_log_opt_in: i64,
    timezone: String,
}

async fn get_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let row = sqlx::query_as::<_, ProfileRow>(
        "SELECT user_id, activity_log_opt_in, timezone FROM elder_profiles WHERE user_id = ?",
    )
    .bind(&elder_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "user_id": row.user_id,
        "activity_log_opt_in": row.activity_log_opt_in != 0,
        "timezone": row.timezone,
    })))
}

#[derive(Deserialize)]
struct PatchProfileBody {
    activity_log_opt_in: Option<bool>,
    timezone: Option<String>,
}

async fn patch_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
    Json(body): Json<PatchProfileBody>,
) -> Result<Json<Value>, AppError> {
    let elder_id = resolve_elder_id(&elder_id, &user.user_id);
    if user.user_id != elder_id {
        return Err(AppError::NotFound);
    }
    ensure_profile(&state, &elder_id).await?;
    if let Some(flag) = body.activity_log_opt_in {
        sqlx::query(
            "UPDATE elder_profiles SET activity_log_opt_in = ?, updated_at = ? WHERE user_id = ?",
        )
        .bind(i64::from(flag))
        .bind(now_rfc3339())
        .bind(&elder_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    }
    if let Some(tz) = body
        .timezone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sqlx::query("UPDATE elder_profiles SET timezone = ?, updated_at = ? WHERE user_id = ?")
            .bind(tz)
            .bind(now_rfc3339())
            .bind(&elder_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
    }
    get_profile(State(state), user, Path(elder_id)).await
}

#[derive(FromRow, Serialize)]
struct NoticeRow {
    id: String,
    caregiver_user_id: String,
    elder_user_id: String,
    kind: String,
    body: String,
    read_at: Option<String>,
    created_at: String,
}

async fn list_notices(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let items = sqlx::query_as::<_, NoticeRow>(
        "SELECT id, caregiver_user_id, elder_user_id, kind, body, read_at, created_at
         FROM elder_notices WHERE caregiver_user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({ "items": items })))
}

#[derive(FromRow, Serialize)]
struct SmsRow {
    id: String,
    to_user_id: String,
    elder_user_id: String,
    purpose: String,
    body: String,
    created_at: String,
}

async fn list_sms_log(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let items = sqlx::query_as::<_, SmsRow>(
        "SELECT id, to_user_id, elder_user_id, purpose, body, created_at
         FROM elder_sms_log WHERE elder_user_id = ? ORDER BY created_at DESC",
    )
    .bind(&elder_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({ "items": items })))
}

#[derive(FromRow, Serialize)]
struct ActivityRow {
    id: String,
    elder_user_id: String,
    event_type: String,
    payload_json: String,
    created_at: String,
}

async fn list_activity(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::ViewLog).await?;
    let rows = sqlx::query_as::<_, ActivityRow>(
        "SELECT id, elder_user_id, event_type, payload_json, created_at
         FROM elder_activity_log WHERE elder_user_id = ? ORDER BY created_at DESC",
    )
    .bind(&elder_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "elder_user_id": row.elder_user_id,
                "event_type": row.event_type,
                "payload": serde_json::from_str::<Value>(&row.payload_json).unwrap_or(Value::Null),
                "created_at": row.created_at,
            })
        })
        .collect();
    Ok(Json(json!({ "items": items })))
}

#[derive(Deserialize)]
struct ActivityBody {
    event_type: String,
    contact_id: Option<String>,
    tutorial_id: Option<String>,
}

async fn post_activity(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
    Json(body): Json<ActivityBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    if user.user_id != elder_id {
        return Err(AppError::NotFound);
    }
    let event_type = body.event_type.trim();
    if !matches!(
        event_type,
        "call_tapped" | "tutorial_opened" | "reminder_acked"
    ) {
        return Err(AppError::InvalidRequest("event_type is invalid".into()));
    }
    let payload = json!({
        "contact_id": body.contact_id,
        "tutorial_id": body.tutorial_id,
    });
    write_activity(&state, &elder_id, event_type, payload.clone()).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "event_type": event_type, "payload": payload })),
    ))
}

#[derive(Deserialize)]
struct ExplainBody {
    topic: String,
}

async fn ai_explain(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<ExplainBody>,
) -> Result<Json<Value>, AppError> {
    let topic = body.topic.trim();
    if topic.is_empty() {
        return Err(AppError::InvalidRequest("topic is required".into()));
    }
    match state
        .ai
        .complete(CompletionRequest {
            messages: vec![ChatMessage {
                role: "user".into(),
                content: format!("用简短中文说明为何这类来电或消息可能是诈骗：{topic}"),
            }],
            model: None,
        })
        .await
    {
        Ok(done) => Ok(Json(serde_json::to_value(done).unwrap_or(Value::Null))),
        Err(AiError::Unconfigured) => Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}
