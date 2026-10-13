mod cycles;
mod plans;
mod reminders;
mod reports;
mod sleep;
mod water;

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::elder::parse_hhmm;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::now_rfc3339;

pub const DISCLAIMER: &str = "本模块为生活习惯记录工具，不构成医疗建议。身体不适请及时就医。";
pub const PREDICTION_LABEL: &str = "仅供参考";
pub const DEFAULT_WATER_ML: i64 = 2000;
pub const DEFAULT_CUP_ML: i64 = 250;
pub const DEFAULT_WINDOW_START: &str = "08:00";
pub const DEFAULT_WINDOW_END: &str = "22:00";
pub const DEFAULT_INTERVAL_HOURS: i64 = 2;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/wellness/today", get(today))
        .route("/v1/wellness/goals", get(get_goals).put(put_goals))
        .route(
            "/v1/wellness/consent",
            get(cycles::get_consent).put(cycles::put_consent),
        )
        .route("/v1/wellness/water", get(water::list).post(water::create))
        .route(
            "/v1/wellness/water/{id}",
            get(water::get).delete(water::delete),
        )
        .route("/v1/wellness/sleep", get(sleep::list).post(sleep::create))
        .route(
            "/v1/wellness/sleep/{id}",
            get(sleep::get).patch(sleep::patch).delete(sleep::delete),
        )
        .route("/v1/wellness/cycles/prediction", get(cycles::prediction))
        .route(
            "/v1/wellness/cycles",
            get(cycles::list).post(cycles::create),
        )
        .route(
            "/v1/wellness/cycles/{id}",
            get(cycles::get).patch(cycles::patch).delete(cycles::delete),
        )
        .route("/v1/wellness/reports/ocr", post(reports::ocr))
        .route(
            "/v1/wellness/reports",
            get(reports::list).post(reports::create),
        )
        .route(
            "/v1/wellness/reports/{id}",
            get(reports::get)
                .patch(reports::patch)
                .delete(reports::delete),
        )
        .route("/v1/wellness/plans/suggest", post(plans::suggest))
        .route("/v1/wellness/plans", get(plans::list).post(plans::create))
        .route(
            "/v1/wellness/plans/{id}",
            get(plans::get).delete(plans::delete),
        )
        .route("/v1/wellness/plans/{id}/checkins", post(plans::checkin))
        .route(
            "/v1/wellness/reminders",
            get(reminders::list).post(reminders::create),
        )
        .route(
            "/v1/wellness/reminders/{id}",
            axum::routing::patch(reminders::patch).delete(reminders::delete),
        )
}

pub fn shanghai_today() -> NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

pub fn parse_date(raw: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("date must be YYYY-MM-DD".into()))
}

pub fn require_ml(ml: i64) -> Result<i64, AppError> {
    if ml <= 0 {
        return Err(AppError::InvalidRequest("ml must be > 0".into()));
    }
    if ml > 5000 {
        return Err(AppError::InvalidRequest("ml is too large".into()));
    }
    Ok(ml)
}

pub fn expand_interval(start: &str, end: &str, every_hours: i64) -> Result<Vec<String>, AppError> {
    if !(1..=12).contains(&every_hours) {
        return Err(AppError::InvalidRequest(
            "interval_hours must be 1-12".into(),
        ));
    }
    let (sh, sm) = parse_hhmm(start)?;
    let (eh, em) = parse_hhmm(end)?;
    let start_mins = i64::from(sh) * 60 + i64::from(sm);
    let end_mins = i64::from(eh) * 60 + i64::from(em);
    if end_mins < start_mins {
        return Err(AppError::InvalidRequest(
            "window_end must be on or after window_start".into(),
        ));
    }
    let step = every_hours * 60;
    let mut times = Vec::new();
    let mut cur = start_mins;
    while cur <= end_mins {
        times.push(format!("{:02}:{:02}", cur / 60, cur % 60));
        cur += step;
        if times.len() > 24 {
            return Err(AppError::InvalidRequest(
                "interval produces too many times".into(),
            ));
        }
    }
    if times.is_empty() {
        return Err(AppError::InvalidRequest(
            "interval produced no reminder times".into(),
        ));
    }
    Ok(times)
}

pub fn encrypt_text(
    crypto: &FieldCrypto,
    raw: Option<&str>,
    max_chars: usize,
    field: &str,
) -> Result<Option<Vec<u8>>, AppError> {
    let Some(text) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if text.chars().count() > max_chars {
        return Err(AppError::InvalidRequest(format!(
            "{field} must be at most {max_chars} characters"
        )));
    }
    Ok(Some(crypto.encrypt(text.as_bytes())?))
}

pub fn decrypt_text(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Option<String> {
    blob.and_then(|bytes| crypto.decrypt(bytes).ok())
        .and_then(|plain| String::from_utf8(plain).ok())
}

pub async fn ensure_goals(state: &AppState, user_id: &str) -> Result<GoalRow, AppError> {
    if let Some(row) = load_goals(state, user_id).await? {
        return Ok(row);
    }
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_goals (user_id, water_ml_target, cycle_consent, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?)",
    )
    .bind(user_id)
    .bind(DEFAULT_WATER_ML)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    load_goals(state, user_id)
        .await?
        .ok_or(AppError::Unavailable(
            "failed to create wellness goals".into(),
        ))
}

pub async fn load_goals(state: &AppState, user_id: &str) -> Result<Option<GoalRow>, AppError> {
    sqlx::query_as::<_, GoalRow>(
        "SELECT user_id, water_ml_target, cycle_consent, created_at, updated_at
         FROM well_goals WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)
}

#[derive(sqlx::FromRow, Clone)]
pub struct GoalRow {
    pub user_id: String,
    pub water_ml_target: i64,
    pub cycle_consent: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl GoalRow {
    fn public(&self) -> Value {
        json!({
            "water_ml_target": self.water_ml_target,
            "cycle_consent": self.cycle_consent != 0,
            "disclaimer": DISCLAIMER,
        })
    }
}

async fn today(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let goals = ensure_goals(&state, &user.user_id).await?;
    reminders::ensure_defaults(&state, &user.user_id).await?;
    reminders::maintain_user(&state, &user.user_id).await?;
    let date = shanghai_today().to_string();
    let total = water::total_for_day(&state, &user.user_id, &date).await?;
    let sleep = sleep::latest(&state, &user.user_id).await?;
    let consent = goals.cycle_consent != 0;
    let prediction = if consent {
        Some(cycles::compute_prediction(&state, &user.user_id).await?)
    } else {
        None
    };
    let plans = plans::export_rows(&state, &user.user_id).await?;
    Ok(Json(json!({
        "disclaimer": DISCLAIMER,
        "date": date,
        "water": {
            "total_ml": total,
            "target_ml": goals.water_ml_target,
            "cup_ml": DEFAULT_CUP_ML,
        },
        "sleep": sleep,
        "cycle_consent": consent,
        "prediction": prediction,
        "plans": plans,
    })))
}

async fn get_goals(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let goals = ensure_goals(&state, &user.user_id).await?;
    Ok(Json(goals.public()))
}

#[derive(Deserialize)]
struct PutGoalsBody {
    water_ml_target: i64,
}

async fn put_goals(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PutGoalsBody>,
) -> Result<Json<Value>, AppError> {
    let target = require_ml(body.water_ml_target)?;
    if !(500..=5000).contains(&target) {
        return Err(AppError::InvalidRequest(
            "water_ml_target must be 500-5000".into(),
        ));
    }
    let _ = ensure_goals(&state, &user.user_id).await?;
    sqlx::query("UPDATE well_goals SET water_ml_target = ?, updated_at = ? WHERE user_id = ?")
        .bind(target)
        .bind(now_rfc3339())
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(Json(ensure_goals(&state, &user.user_id).await?.public()))
}

pub async fn export_for_user(state: &AppState, user_id: &str) -> Result<Value, AppError> {
    let goals = load_goals(state, user_id).await?;
    let consent = goals.as_ref().is_some_and(|row| row.cycle_consent != 0);
    let cycles = if consent {
        cycles::export_rows(state, user_id).await?
    } else {
        Vec::new()
    };
    Ok(json!({
        "goals": goals.as_ref().map(GoalRow::public),
        "cycle_consent": consent,
        "water_logs": water::export_rows(state, user_id).await?,
        "sleep_logs": sleep::export_rows(state, user_id).await?,
        "cycles": cycles,
        "reports": reports::export_rows(state, user_id).await?,
        "plans": plans::export_rows(state, user_id).await?,
        "reminders": reminders::export_rows(state, user_id).await?,
    }))
}

pub async fn maintain_reminders(state: &AppState) -> Result<(), AppError> {
    reminders::maintain_all(state).await
}

#[derive(Deserialize)]
struct DateQuery {
    date: Option<String>,
}

#[derive(Deserialize)]
struct CreateWaterBody {
    ml: Option<i64>,
    logged_on: Option<String>,
}

#[derive(Deserialize)]
struct CreateSleepBody {
    sleep_at: String,
    wake_at: String,
    quality: i64,
    note: Option<String>,
}

#[derive(Deserialize)]
struct PatchSleepBody {
    sleep_at: Option<String>,
    wake_at: Option<String>,
    quality: Option<i64>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct ConsentBody {
    cycle_consent: bool,
}

#[derive(Deserialize)]
struct CreateCycleBody {
    start_date: String,
    end_date: Option<String>,
    flow_level: Option<String>,
    symptoms: Option<String>,
}

#[derive(Deserialize)]
struct PatchCycleBody {
    start_date: Option<String>,
    end_date: Option<String>,
    flow_level: Option<String>,
    symptoms: Option<String>,
}

#[derive(Deserialize)]
struct MetricBody {
    name: String,
    value: String,
    unit: Option<String>,
}

#[derive(Deserialize)]
struct CreateReportBody {
    title: String,
    report_date: String,
    metrics: Vec<MetricBody>,
    file_url: Option<String>,
}

#[derive(Deserialize)]
struct PatchReportBody {
    title: Option<String>,
    report_date: Option<String>,
    metrics: Option<Vec<MetricBody>>,
    confirmed: Option<bool>,
}

#[derive(Deserialize)]
struct OcrBody {
    text: String,
    file_url: Option<String>,
}

#[derive(Deserialize)]
struct CreatePlanBody {
    kind: String,
    target_days: Option<i64>,
    start_date: Option<String>,
}

#[derive(Deserialize)]
struct CheckinBody {
    day: Option<String>,
}

#[derive(Deserialize)]
struct CreateReminderBody {
    kind: Option<String>,
    time_local: Option<String>,
    days_of_week: Option<Vec<u8>>,
    timezone: Option<String>,
    interval_hours: Option<i64>,
    window_start: Option<String>,
    window_end: Option<String>,
    active: Option<bool>,
}

#[derive(Deserialize)]
struct PatchReminderBody {
    time_local: Option<String>,
    days_of_week: Option<Vec<u8>>,
    timezone: Option<String>,
    active: Option<bool>,
}
