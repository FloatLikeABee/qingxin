use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, NaiveDate};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    decrypt_text, encrypt_text, ensure_goals, parse_date, shanghai_today, ConsentBody,
    CreateCycleBody, PatchCycleBody, DISCLAIMER, PREDICTION_LABEL,
};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct CycleRow {
    id: String,
    start_date: String,
    end_date: Option<String>,
    flow_level: Option<String>,
    symptoms_encrypted: Option<Vec<u8>>,
    created_at: String,
    updated_at: String,
}

impl CycleRow {
    fn public(&self, crypto: &FieldCrypto) -> Value {
        json!({
            "id": self.id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "flow_level": self.flow_level,
            "symptoms": decrypt_text(crypto, self.symptoms_encrypted.as_deref()),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

fn require_flow(raw: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(value) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    match value {
        "light" | "medium" | "heavy" => Ok(Some(value.to_string())),
        _ => Err(AppError::InvalidRequest(
            "flow_level must be light, medium or heavy".into(),
        )),
    }
}

async fn require_consent(state: &AppState, user_id: &str) -> Result<(), AppError> {
    let goals = ensure_goals(state, user_id).await?;
    if goals.cycle_consent == 0 {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<CycleRow, AppError> {
    sqlx::query_as::<_, CycleRow>(
        "SELECT id, start_date, end_date, flow_level, symptoms_encrypted, created_at, updated_at
         FROM well_cycles WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, CycleRow>(
        "SELECT id, start_date, end_date, flow_level, symptoms_encrypted, created_at, updated_at
         FROM well_cycles WHERE user_id = ? ORDER BY start_date DESC, id DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(&state.crypto)).collect())
}

pub async fn get_consent(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let goals = ensure_goals(&state, &user.user_id).await?;
    Ok(Json(json!({
        "cycle_consent": goals.cycle_consent != 0,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn put_consent(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ConsentBody>,
) -> Result<Json<Value>, AppError> {
    let _ = ensure_goals(&state, &user.user_id).await?;
    sqlx::query("UPDATE well_goals SET cycle_consent = ?, updated_at = ? WHERE user_id = ?")
        .bind(i64::from(body.cycle_consent))
        .bind(now_rfc3339())
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if !body.cycle_consent {
        sqlx::query("DELETE FROM well_cycles WHERE user_id = ?")
            .bind(&user.user_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
    }
    Ok(Json(json!({
        "cycle_consent": body.cycle_consent,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let goals = ensure_goals(&state, &user.user_id).await?;
    let consent = goals.cycle_consent != 0;
    let items = if consent {
        export_rows(&state, &user.user_id).await?
    } else {
        Vec::new()
    };
    Ok(Json(json!({
        "items": items,
        "cycle_consent": consent,
        "disclaimer": DISCLAIMER,
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateCycleBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    require_consent(&state, &user.user_id).await?;
    let start = parse_date(&body.start_date)?;
    let end = match body.end_date.as_deref() {
        Some(raw) => Some(parse_date(raw)?),
        None => None,
    };
    if let Some(end) = end {
        if end < start {
            return Err(AppError::InvalidRequest(
                "end_date must be on or after start_date".into(),
            ));
        }
    }
    let flow = require_flow(body.flow_level.as_deref())?;
    let symptoms = encrypt_text(&state.crypto, body.symptoms.as_deref(), 200, "symptoms")?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_cycles
            (id, user_id, start_date, end_date, flow_level, symptoms_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(start.to_string())
    .bind(end.map(|d| d.to_string()))
    .bind(flow)
    .bind(symptoms)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(
            load_one(&state, &user.user_id, &id)
                .await?
                .public(&state.crypto),
        ),
    ))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    require_consent(&state, &user.user_id).await?;
    Ok(Json(
        load_one(&state, &user.user_id, &id)
            .await?
            .public(&state.crypto),
    ))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchCycleBody>,
) -> Result<Json<Value>, AppError> {
    require_consent(&state, &user.user_id).await?;
    let current = load_one(&state, &user.user_id, &id).await?;
    let start = match body.start_date.as_deref() {
        Some(raw) => parse_date(raw)?,
        None => parse_date(&current.start_date)?,
    };
    let end = match body.end_date.as_deref() {
        Some(raw) => Some(parse_date(raw)?),
        None => current.end_date.as_deref().map(parse_date).transpose()?,
    };
    if let Some(end) = end {
        if end < start {
            return Err(AppError::InvalidRequest(
                "end_date must be on or after start_date".into(),
            ));
        }
    }
    let flow = match body.flow_level.as_deref() {
        Some(_) => require_flow(body.flow_level.as_deref())?,
        None => current.flow_level.clone(),
    };
    let symptoms = if body.symptoms.is_some() {
        encrypt_text(&state.crypto, body.symptoms.as_deref(), 200, "symptoms")?
    } else {
        current.symptoms_encrypted.clone()
    };
    sqlx::query(
        "UPDATE well_cycles
         SET start_date = ?, end_date = ?, flow_level = ?, symptoms_encrypted = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(start.to_string())
    .bind(end.map(|d| d.to_string()))
    .bind(flow)
    .bind(symptoms)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(
        load_one(&state, &user.user_id, &id)
            .await?
            .public(&state.crypto),
    ))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_consent(&state, &user.user_id).await?;
    let _ = load_one(&state, &user.user_id, &id).await?;
    sqlx::query("DELETE FROM well_cycles WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn prediction(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    require_consent(&state, &user.user_id).await?;
    Ok(Json(compute_prediction(&state, &user.user_id).await?))
}

pub async fn compute_prediction(state: &AppState, user_id: &str) -> Result<Value, AppError> {
    let starts: Vec<String> = sqlx::query_scalar(
        "SELECT start_date FROM well_cycles WHERE user_id = ? ORDER BY start_date ASC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let dates: Vec<NaiveDate> = starts
        .iter()
        .map(|raw| parse_date(raw))
        .collect::<Result<Vec<_>, _>>()?;
    let mut lengths = Vec::new();
    for pair in dates.windows(2) {
        lengths.push((pair[1] - pair[0]).num_days());
    }
    if lengths.len() > 6 {
        lengths = lengths[lengths.len() - 6..].to_vec();
    }
    let average = if lengths.is_empty() {
        28
    } else {
        let sum: i64 = lengths.iter().sum();
        (sum as f64 / lengths.len() as f64).round() as i64
    };
    let last_start = dates.last().copied().unwrap_or_else(shanghai_today);
    let next_start = last_start + Duration::days(average);
    let ovulation = next_start - Duration::days(14);
    let fertile_start = ovulation - Duration::days(5);
    let fertile_end = ovulation + Duration::days(1);
    Ok(json!({
        "average_length_days": average,
        "sample_count": lengths.len(),
        "last_start": last_start.to_string(),
        "next_start": next_start.to_string(),
        "fertile_start": fertile_start.to_string(),
        "fertile_end": fertile_end.to_string(),
        "label": PREDICTION_LABEL,
        "disclaimer": DISCLAIMER,
    }))
}
