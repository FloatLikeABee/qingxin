mod challenges;
mod flashcards;
mod notes;
mod reminders;
mod review;
mod skills;

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::elder::tz_offset;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;

pub const DISCLAIMER: &str = "本模块为学习习惯记录工具，不构成教学辅导或心理咨询。";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/study/today", get(today))
        .route(
            "/v1/study/challenges",
            get(challenges::list).post(challenges::create),
        )
        .route(
            "/v1/study/challenges/{id}",
            get(challenges::get).delete(challenges::delete),
        )
        .route(
            "/v1/study/challenges/{id}/checkins",
            post(challenges::checkin),
        )
        .route("/v1/study/flashcards/due", get(flashcards::due))
        .route("/v1/study/flashcards/classify", post(flashcards::classify))
        .route(
            "/v1/study/flashcards",
            get(flashcards::list).post(flashcards::create),
        )
        .route(
            "/v1/study/flashcards/{id}",
            get(flashcards::get).delete(flashcards::delete),
        )
        .route("/v1/study/flashcards/{id}/review", post(flashcards::review))
        .route("/v1/study/notes", get(notes::list).post(notes::create))
        .route(
            "/v1/study/notes/{id}",
            get(notes::get).patch(notes::patch).delete(notes::delete),
        )
        .route("/v1/study/skills/templates", get(skills::templates))
        .route(
            "/v1/study/skills/from-template",
            post(skills::from_template),
        )
        .route("/v1/study/skills", get(skills::list).post(skills::create))
        .route(
            "/v1/study/skills/{id}",
            axum::routing::patch(skills::patch).delete(skills::delete),
        )
        .route(
            "/v1/study/reminders",
            get(reminders::list).post(reminders::create),
        )
        .route(
            "/v1/study/reminders/{id}",
            axum::routing::patch(reminders::patch).delete(reminders::delete),
        )
}

pub fn parse_date(raw: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("date must be YYYY-MM-DD".into()))
}

pub fn local_date(tz_name: &str, from: DateTime<Utc>) -> NaiveDate {
    from.with_timezone(&tz_offset(tz_name)).date_naive()
}

pub fn require_timezone(raw: Option<&str>) -> String {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some("UTC" | "Etc/UTC" | "Z") => "UTC".into(),
        _ => "Asia/Shanghai".into(),
    }
}

pub fn require_target_days(days: i64) -> Result<i64, AppError> {
    if matches!(days, 7 | 14 | 21) {
        Ok(days)
    } else {
        Err(AppError::InvalidRequest(
            "target_days must be 7, 14 or 21".into(),
        ))
    }
}

pub fn require_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(AppError::InvalidRequest("name is invalid".into()));
    }
    Ok(name.to_string())
}

pub fn current_streak(days: &[NaiveDate], today: NaiveDate) -> i64 {
    let set: std::collections::BTreeSet<NaiveDate> = days.iter().copied().collect();
    let start = if set.contains(&today) {
        today
    } else if set.contains(&(today - chrono::Duration::days(1))) {
        today - chrono::Duration::days(1)
    } else {
        return 0;
    };
    let mut n = 0;
    let mut cursor = start;
    while set.contains(&cursor) {
        n += 1;
        cursor -= chrono::Duration::days(1);
    }
    n
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

pub fn require_encrypt(
    crypto: &FieldCrypto,
    raw: &str,
    max_chars: usize,
    field: &str,
) -> Result<Vec<u8>, AppError> {
    encrypt_text(crypto, Some(raw), max_chars, field)?
        .ok_or_else(|| AppError::InvalidRequest(format!("{field} is required")))
}

pub fn decrypt_text(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Option<String> {
    blob.and_then(|bytes| crypto.decrypt(bytes).ok())
        .and_then(|plain| String::from_utf8(plain).ok())
}

pub async fn export_for_user(state: &AppState, user_id: &str) -> Result<Value, AppError> {
    Ok(json!({
        "challenges": challenges::export_rows(state, user_id).await?,
        "flashcards": flashcards::export_rows(state, user_id).await?,
        "notes": notes::export_rows(state, user_id).await?,
        "skills": skills::export_rows(state, user_id).await?,
        "reminders": reminders::export_rows(state, user_id).await?,
    }))
}

pub async fn maintain_reminders(state: &AppState) -> Result<(), AppError> {
    reminders::maintain_all(state).await
}

pub async fn should_skip_push(
    state: &AppState,
    user_id: &str,
    payload: &Value,
) -> Result<bool, AppError> {
    if payload.get("type").and_then(Value::as_str) != Some("study.streak") {
        return Ok(false);
    }
    let tz = payload
        .get("timezone")
        .and_then(Value::as_str)
        .unwrap_or("Asia/Shanghai");
    let day = local_date(tz, Utc::now()).to_string();
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM study_checkins WHERE user_id = ? AND day = ?")
            .bind(user_id)
            .bind(day)
            .fetch_one(&state.pool)
            .await
            .map_err(map_sqlx)?;
    Ok(count > 0)
}

async fn today(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    reminders::maintain_user(&state, &user.user_id).await?;
    let date = local_date("Asia/Shanghai", Utc::now()).to_string();
    Ok(Json(json!({
        "disclaimer": DISCLAIMER,
        "date": date,
        "challenges": challenges::today_rows(&state, &user.user_id, &date).await?,
        "due_flashcards": flashcards::due_count(&state, &user.user_id, &date).await?,
    })))
}

#[derive(Deserialize)]
struct CreateChallengeBody {
    name: String,
    target_days: i64,
    start_date: Option<String>,
    timezone: Option<String>,
}

#[derive(Deserialize)]
struct CheckinBody {
    day: Option<String>,
}

#[derive(Deserialize)]
struct CreateCardBody {
    front: String,
    back: String,
    category: Option<String>,
    file_url: Option<String>,
}

#[derive(Deserialize)]
struct ReviewBody {
    grade: String,
}

#[derive(Deserialize)]
struct ClassifyBody {
    front: String,
    back: String,
}

#[derive(Deserialize)]
struct NotesQuery {
    q: Option<String>,
}

#[derive(Deserialize)]
struct CreateNoteBody {
    title: String,
    content_md: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct PatchNoteBody {
    title: Option<String>,
    content_md: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct CreateSkillBody {
    title: String,
    parent_id: Option<String>,
    unlocked: Option<bool>,
    sort_order: Option<i64>,
}

#[derive(Deserialize)]
struct PatchSkillBody {
    title: Option<String>,
    parent_id: Option<String>,
    unlocked: Option<bool>,
    sort_order: Option<i64>,
}

#[derive(Deserialize)]
struct FromTemplateBody {
    template_id: String,
}

#[derive(Deserialize)]
struct CreateReminderBody {
    kind: Option<String>,
    time_local: String,
    days_of_week: Option<Vec<u8>>,
    timezone: Option<String>,
    active: Option<bool>,
}

#[derive(Deserialize)]
struct PatchReminderBody {
    time_local: Option<String>,
    days_of_week: Option<Vec<u8>>,
    timezone: Option<String>,
    active: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::current_streak;
    use chrono::NaiveDate;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn consecutive_streak_counts_back_from_today() {
        let days = [d(2026, 10, 11), d(2026, 10, 12), d(2026, 10, 13)];
        assert_eq!(current_streak(&days, d(2026, 10, 13)), 3);
    }

    #[test]
    fn gap_resets_to_one() {
        let days = [d(2026, 10, 10), d(2026, 10, 13)];
        assert_eq!(current_streak(&days, d(2026, 10, 13)), 1);
    }
}
