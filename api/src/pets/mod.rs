mod logs;
mod profiles;
mod records;
mod reminders;

use axum::extract::State;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use chrono::{DateTime, Duration, FixedOffset, NaiveDate, SecondsFormat, TimeZone, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const DISCLAIMER: &str =
    "非兽医建议。本模块为工具辅助与信息展示，不构成诊疗意见。如宠物出现异常请及时就医。";
pub(crate) const DEFAULT_TZ: &str = "Asia/Shanghai";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/pets", get(profiles::list).post(profiles::create))
        .route("/v1/pets/today", get(today))
        .route("/v1/pets/ai/care-tip", post(ai_care_tip))
        .route(
            "/v1/pets/records/{id}",
            patch(records::patch).delete(records::delete),
        )
        .route(
            "/v1/pets/reminders/{id}",
            patch(reminders::patch).delete(reminders::delete),
        )
        .route(
            "/v1/pets/{id}",
            get(profiles::get)
                .patch(profiles::patch)
                .delete(profiles::delete),
        )
        .route(
            "/v1/pets/{id}/records",
            get(records::list).post(records::create),
        )
        .route(
            "/v1/pets/{id}/weights",
            get(logs::list_weights).post(logs::create_weight),
        )
        .route("/v1/pets/{id}/logs", get(logs::list).post(logs::create))
        .route(
            "/v1/pets/{id}/reminders",
            get(reminders::list).post(reminders::create),
        )
}

#[derive(FromRow)]
struct PetRow {
    id: String,
    name: String,
    species: String,
    breed: Option<String>,
    birthday: Option<String>,
    avatar_url: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

impl PetRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "species": self.species,
            "breed": self.breed,
            "birthday": self.birthday,
            "avatar_url": self.avatar_url,
            "sort_order": self.sort_order,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const PET_SELECT: &str = "SELECT id, name, species, breed, birthday, avatar_url, sort_order,
        created_at, updated_at FROM pet_pets";

async fn owned_pet(state: &AppState, user_id: &str, pet_id: &str) -> Result<PetRow, AppError> {
    sqlx::query_as::<_, PetRow>(&format!("{PET_SELECT} WHERE id = ? AND user_id = ?"))
        .bind(pet_id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

fn require_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim();
    if name.is_empty() || name.chars().count() > 40 {
        return Err(AppError::InvalidRequest(
            "name must be 1-40 characters".into(),
        ));
    }
    Ok(name.to_string())
}

fn require_species(raw: &str) -> Result<&str, AppError> {
    match raw.trim() {
        "cat" | "dog" | "other" => Ok(raw.trim()),
        _ => Err(AppError::InvalidRequest(
            "species must be cat, dog or other".into(),
        )),
    }
}

fn require_record_type(raw: &str) -> Result<&str, AppError> {
    match raw.trim() {
        "vaccine" | "deworm" | "checkup" | "vet_visit" => Ok(raw.trim()),
        _ => Err(AppError::InvalidRequest(
            "type must be vaccine, deworm, checkup or vet_visit".into(),
        )),
    }
}

fn require_log_type(raw: &str) -> Result<&str, AppError> {
    match raw.trim() {
        "feed" | "walk" | "groom" | "litter" => Ok(raw.trim()),
        _ => Err(AppError::InvalidRequest(
            "type must be feed, walk, groom or litter".into(),
        )),
    }
}

fn require_care_kind(raw: &str) -> Result<&str, AppError> {
    require_log_type(raw)
        .map_err(|_| AppError::InvalidRequest("kind must be feed, walk, groom or litter".into()))
}

fn parse_date(raw: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("date must be YYYY-MM-DD".into()))
}

fn optional_date(raw: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    Ok(Some(parse_date(raw)?.to_string()))
}

fn optional_text(raw: Option<&str>, max: usize, field: &str) -> Result<Option<String>, AppError> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if raw.chars().count() > max {
        return Err(AppError::InvalidRequest(format!(
            "{field} must be at most {max} characters"
        )));
    }
    Ok(Some(raw.to_string()))
}

fn encrypt_note(crypto: &FieldCrypto, note: Option<&str>) -> Result<Option<Vec<u8>>, AppError> {
    let Some(note) = note.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if note.chars().count() > 500 {
        return Err(AppError::InvalidRequest(
            "note must be at most 500 characters".into(),
        ));
    }
    Ok(Some(crypto.encrypt(note.as_bytes())?))
}

fn decrypt_note(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Option<String> {
    blob.and_then(|bytes| crypto.decrypt(bytes).ok())
        .and_then(|plain| String::from_utf8(plain).ok())
}

fn shanghai_today() -> NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

fn due_run_at(next_due: NaiveDate, tz_name: &str) -> Result<String, AppError> {
    let remind_on = next_due - Duration::days(1);
    let offset = crate::elder::tz_offset(tz_name);
    let naive = remind_on
        .and_hms_opt(9, 0, 0)
        .ok_or_else(|| AppError::InvalidRequest("next_due_date is invalid".into()))?;
    let local = offset
        .from_local_datetime(&naive)
        .single()
        .ok_or_else(|| AppError::InvalidRequest("could not compute due reminder time".into()))?;
    Ok(local
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Secs, true))
}

async fn enqueue_job(
    state: &AppState,
    user_id: &str,
    kind: &str,
    run_at: &str,
    payload: &Value,
) -> Result<String, AppError> {
    let id = new_id();
    sqlx::query(
        "INSERT INTO scheduled_jobs
            (id, user_id, kind, payload_json, run_at, status, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(kind)
    .bind(payload.to_string())
    .bind(run_at)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(id)
}

async fn cancel_jobs_like(
    state: &AppState,
    user_id: &str,
    kind: &str,
    needle: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE scheduled_jobs SET status = 'cancelled'
         WHERE user_id = ? AND kind = ? AND status = 'pending' AND payload_json LIKE ?",
    )
    .bind(user_id)
    .bind(kind)
    .bind(format!("%{needle}%"))
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

fn day_bounds(day: NaiveDate, tz_name: &str) -> Result<(String, String), AppError> {
    let offset = crate::elder::tz_offset(tz_name);
    let start = local_midnight(day, offset)?;
    let end = local_midnight(day + Duration::days(1), offset)?;
    Ok((start, end))
}

fn local_midnight(day: NaiveDate, offset: FixedOffset) -> Result<String, AppError> {
    let naive = day
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| AppError::InvalidRequest("date is invalid".into()))?;
    let local = offset
        .from_local_datetime(&naive)
        .single()
        .ok_or_else(|| AppError::InvalidRequest("could not compute local midnight".into()))?;
    Ok(local
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Secs, true))
}

pub async fn after_job(
    state: &AppState,
    _user_id: &str,
    _job_id: &str,
    payload: &Value,
) -> Result<(), AppError> {
    match payload.get("type").and_then(Value::as_str) {
        Some("pet.care") => reminders::requeue(state, payload).await,
        _ => Ok(()),
    }
}

pub async fn export_for_user(state: &AppState, user_id: &str) -> Result<Value, AppError> {
    let pets = sqlx::query_as::<_, PetRow>(&format!(
        "{PET_SELECT} WHERE user_id = ? ORDER BY sort_order, created_at"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(json!({
        "pets": pets.iter().map(PetRow::public).collect::<Vec<_>>(),
        "records": records::export_rows(state, user_id).await?,
        "weights": logs::export_weights(state, user_id).await?,
        "logs": logs::export_logs(state, user_id).await?,
        "reminders": reminders::export_rows(state, user_id).await?,
    }))
}

async fn today(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let pets = sqlx::query_as::<_, PetRow>(&format!(
        "{PET_SELECT} WHERE user_id = ? ORDER BY sort_order, created_at"
    ))
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let today = shanghai_today();
    let (start, end) = day_bounds(today, DEFAULT_TZ)?;
    let mut items = Vec::new();
    for pet in pets {
        let counts = sqlx::query_as::<_, (String, i64)>(
            "SELECT type, COUNT(*) FROM pet_daily_logs
             WHERE user_id = ? AND pet_id = ? AND logged_at >= ? AND logged_at < ?
             GROUP BY type",
        )
        .bind(&user.user_id)
        .bind(&pet.id)
        .bind(&start)
        .bind(&end)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?;
        let mut done = json!({ "feed": 0, "walk": 0, "groom": 0, "litter": 0 });
        for (kind, count) in counts {
            done[kind] = json!(count);
        }
        let dues = records::upcoming_dues(&state, &user.user_id, &pet.id, today).await?;
        items.push(json!({
            "pet_id": pet.id,
            "name": pet.name,
            "species": pet.species,
            "avatar_url": pet.avatar_url,
            "done": done,
            "dues": dues,
        }));
    }
    Ok(Json(json!({
        "items": items,
        "disclaimer": DISCLAIMER,
    })))
}

#[derive(Deserialize)]
struct CareTipBody {
    pet_id: String,
    topic: String,
}

async fn ai_care_tip(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CareTipBody>,
) -> Result<Json<Value>, AppError> {
    let pet = owned_pet(&state, &user.user_id, &body.pet_id).await?;
    let topic = body.topic.trim();
    if topic.is_empty() {
        return Err(AppError::InvalidRequest("topic is required".into()));
    }
    match state
        .ai
        .complete(
            &user.user_id,
            CompletionRequest {
                messages: vec![ChatMessage {
                    role: "user".into(),
                    content: format!(
                        "用简短中文给宠物「{}」提供非兽医的日常照护提示，主题：{topic}。不要给出诊断或用药剂量。",
                        pet.name
                    ),
                }],
                model: None,
            },
        )
        .await
    {
        Ok(done) => Ok(Json(json!({
            "content": done.content,
            "model": done.model,
            "disclaimer": DISCLAIMER,
        }))),
        Err(AiError::Unconfigured) => Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}

#[derive(Deserialize)]
struct CreatePetBody {
    name: String,
    species: String,
    breed: Option<String>,
    birthday: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct PatchPetBody {
    name: Option<String>,
    species: Option<String>,
    breed: Option<String>,
    birthday: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct CreateRecordBody {
    #[serde(rename = "type")]
    type_name: String,
    date: String,
    next_due_date: Option<String>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct PatchRecordBody {
    #[serde(rename = "type")]
    type_name: Option<String>,
    date: Option<String>,
    next_due_date: Option<String>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct CreateWeightBody {
    measured_on: String,
    weight_g: i64,
}

#[derive(Deserialize)]
struct CreateLogBody {
    #[serde(rename = "type")]
    type_name: String,
    value: Option<String>,
    logged_at: Option<String>,
}

#[derive(Deserialize)]
struct CreateReminderBody {
    kind: String,
    time_local: String,
    days_of_week: Vec<u8>,
    timezone: Option<String>,
    active: Option<bool>,
}

#[derive(Deserialize)]
struct PatchReminderBody {
    kind: Option<String>,
    time_local: Option<String>,
    days_of_week: Option<Vec<u8>>,
    timezone: Option<String>,
    active: Option<bool>,
}

fn parse_logged_at(raw: Option<&str>) -> Result<String, AppError> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(now_rfc3339());
    };
    DateTime::parse_from_rfc3339(raw)
        .map(|dt| {
            dt.with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Secs, true)
        })
        .map_err(|_| AppError::InvalidRequest("logged_at must be RFC3339".into()))
}
