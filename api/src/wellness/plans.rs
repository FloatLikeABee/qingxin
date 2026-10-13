use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{parse_date, shanghai_today, CheckinBody, CreatePlanBody, DISCLAIMER};
use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct PlanRow {
    id: String,
    kind: String,
    title: String,
    target_days: i64,
    start_date: String,
    created_at: String,
    progress_days: i64,
}

impl PlanRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "target_days": self.target_days,
            "start_date": self.start_date,
            "progress_days": self.progress_days,
            "created_at": self.created_at,
            "disclaimer": DISCLAIMER,
        })
    }
}

#[derive(FromRow)]
struct CheckinRow {
    id: String,
    plan_id: String,
    day: String,
    created_at: String,
}

impl CheckinRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "plan_id": self.plan_id,
            "day": self.day,
            "created_at": self.created_at,
        })
    }
}

const PLAN_SELECT: &str = "SELECT p.id, p.kind, p.title, p.target_days, p.start_date, p.created_at,
        (SELECT COUNT(*) FROM well_plan_checkins k WHERE k.plan_id = p.id) AS progress_days
     FROM well_plans p";

fn plan_title(kind: &str) -> Result<(&'static str, &'static str), AppError> {
    match kind {
        "water_21" => Ok(("water_21", "21天喝水挑战")),
        "sleep_21" => Ok(("sleep_21", "21天睡眠打卡")),
        _ => Err(AppError::InvalidRequest(
            "kind must be water_21 or sleep_21".into(),
        )),
    }
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<PlanRow, AppError> {
    sqlx::query_as::<_, PlanRow>(&format!("{PLAN_SELECT} WHERE p.id = ? AND p.user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, PlanRow>(&format!(
        "{PLAN_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(PlanRow::public).collect())
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
    Json(body): Json<CreatePlanBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let (kind, title) = plan_title(body.kind.trim())?;
    let target = body.target_days.unwrap_or(21);
    if !(1..=90).contains(&target) {
        return Err(AppError::InvalidRequest("target_days must be 1-90".into()));
    }
    let start = match body.start_date.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => shanghai_today().to_string(),
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_plans (id, user_id, kind, title, target_days, start_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(kind)
    .bind(title)
    .bind(target)
    .bind(start)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(load_one(&state, &user.user_id, &id).await?.public()),
    ))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(load_one(&state, &user.user_id, &id).await?.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let _ = load_one(&state, &user.user_id, &id).await?;
    sqlx::query("DELETE FROM well_plans WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn checkin(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CheckinBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let _ = load_one(&state, &user.user_id, &id).await?;
    let day = match body.day.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => shanghai_today().to_string(),
    };
    if let Some(existing) = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, plan_id, day, created_at FROM well_plan_checkins
         WHERE plan_id = ? AND day = ?",
    )
    .bind(&id)
    .bind(&day)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    {
        return Ok((StatusCode::OK, Json(existing.public())));
    }
    let check_id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_plan_checkins (id, plan_id, user_id, day, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&check_id)
    .bind(&id)
    .bind(&user.user_id)
    .bind(&day)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, CheckinRow>(
        "SELECT id, plan_id, day, created_at FROM well_plan_checkins WHERE id = ?",
    )
    .bind(&check_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn suggest(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: "Suggest a 21-day hydration or sleep habit plan as JSON {kind,title}.".into(),
        }],
        model: Some("qingxin-wellness-plan".into()),
    };
    let content = match state.ai.complete(&user.user_id, req).await {
        Ok(done) => done.content,
        Err(AiError::Unconfigured) => return Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => return Err(AppError::Unavailable(msg)),
    };
    Ok(Json(json!({
        "suggestion": content,
        "kind": "water_21",
        "title": "21天喝水挑战",
        "target_days": 21,
        "disclaimer": DISCLAIMER,
        "label": super::PREDICTION_LABEL,
    })))
}
