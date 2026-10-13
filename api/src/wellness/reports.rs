use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    decrypt_text, parse_date, CreateReportBody, MetricBody, OcrBody, PatchReportBody, DISCLAIMER,
};
use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
struct ReportRow {
    id: String,
    report_date: String,
    title: String,
    metrics_encrypted: Option<Vec<u8>>,
    source: String,
    confirmed: i64,
    created_at: String,
}

impl ReportRow {
    fn public(&self, crypto: &FieldCrypto) -> Value {
        json!({
            "id": self.id,
            "report_date": self.report_date,
            "title": self.title,
            "metrics": decrypt_metrics(crypto, self.metrics_encrypted.as_deref()),
            "source": self.source,
            "confirmed": self.confirmed != 0,
            "created_at": self.created_at,
            "disclaimer": DISCLAIMER,
        })
    }
}

fn require_title(raw: &str) -> Result<String, AppError> {
    let title = raw.trim();
    if title.is_empty() || title.chars().count() > 64 {
        return Err(AppError::InvalidRequest("title is invalid".into()));
    }
    Ok(title.to_string())
}

fn reject_file(file_url: Option<&str>) -> Result<(), AppError> {
    if file_url.map(str::trim).is_some_and(|s| !s.is_empty()) {
        return Err(AppError::InvalidRequest(
            "v1 stores report metrics only; file_url is not accepted".into(),
        ));
    }
    Ok(())
}

fn metrics_json(metrics: &[MetricBody]) -> Result<String, AppError> {
    let items: Vec<Value> = metrics
        .iter()
        .map(|item| {
            let name = item.name.trim();
            let value = item.value.trim();
            if name.is_empty() || value.is_empty() {
                return Err(AppError::InvalidRequest(
                    "metric name and value are required".into(),
                ));
            }
            Ok(json!({
                "name": name,
                "value": value,
                "unit": item.unit.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            }))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Value::Array(items).to_string())
}

fn encrypt_metrics(crypto: &FieldCrypto, json: &str) -> Result<Vec<u8>, AppError> {
    crypto.encrypt(json.as_bytes())
}

fn decrypt_metrics(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Value {
    decrypt_text(crypto, blob)
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or(Value::Array(vec![]))
}

fn parse_ocr_metrics(content: &str) -> String {
    let trimmed = content.trim();
    if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(trimmed) {
        return Value::Array(items).to_string();
    }
    if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&trimmed[start..=end]) {
                return Value::Array(items).to_string();
            }
        }
    }
    let excerpt: String = trimmed.chars().take(200).collect();
    json!([{ "name": "原文摘录", "value": excerpt, "unit": Value::Null }]).to_string()
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<ReportRow, AppError> {
    sqlx::query_as::<_, ReportRow>(
        "SELECT id, report_date, title, metrics_encrypted, source, confirmed, created_at
         FROM well_reports WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, ReportRow>(
        "SELECT id, report_date, title, metrics_encrypted, source, confirmed, created_at
         FROM well_reports WHERE user_id = ? ORDER BY report_date DESC, id DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(|row| row.public(&state.crypto)).collect())
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
    Json(body): Json<CreateReportBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    reject_file(body.file_url.as_deref())?;
    let title = require_title(&body.title)?;
    let report_date = parse_date(&body.report_date)?.to_string();
    let metrics = encrypt_metrics(&state.crypto, &metrics_json(&body.metrics)?)?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO well_reports
            (id, user_id, report_date, title, metrics_encrypted, source, confirmed, created_at)
         VALUES (?, ?, ?, ?, ?, 'manual', 1, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(report_date)
    .bind(title)
    .bind(metrics)
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
    Json(body): Json<PatchReportBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let title = match body.title.as_deref() {
        Some(raw) => require_title(raw)?,
        None => current.title,
    };
    let report_date = match body.report_date.as_deref() {
        Some(raw) => parse_date(raw)?.to_string(),
        None => current.report_date,
    };
    let metrics = if let Some(items) = body.metrics.as_deref() {
        encrypt_metrics(&state.crypto, &metrics_json(items)?)?
    } else {
        current.metrics_encrypted.unwrap_or_default()
    };
    let confirmed = body.confirmed.map(i64::from).unwrap_or(current.confirmed);
    sqlx::query(
        "UPDATE well_reports SET title = ?, report_date = ?, metrics_encrypted = ?, confirmed = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(title)
    .bind(report_date)
    .bind(metrics)
    .bind(confirmed)
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
    let _ = load_one(&state, &user.user_id, &id).await?;
    sqlx::query("DELETE FROM well_reports WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ocr(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<OcrBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    reject_file(body.file_url.as_deref())?;
    let text = body.text.trim();
    if text.is_empty() {
        return Err(AppError::InvalidRequest("text is required".into()));
    }
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: format!(
                "Extract checkup metrics as a JSON array of {{name,value,unit}} objects from:\n{text}"
            ),
        }],
        model: Some("qingxin-wellness-ocr".into()),
    };
    let content = match state.ai.complete(&user.user_id, req).await {
        Ok(done) => done.content,
        Err(AiError::Unconfigured) => return Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => return Err(AppError::Unavailable(msg)),
    };
    let metrics_raw = parse_ocr_metrics(&content);
    let metrics = encrypt_metrics(&state.crypto, &metrics_raw)?;
    let id = new_id();
    let now = now_rfc3339();
    let report_date = super::shanghai_today().to_string();
    sqlx::query(
        "INSERT INTO well_reports
            (id, user_id, report_date, title, metrics_encrypted, source, confirmed, created_at)
         VALUES (?, ?, ?, 'OCR 待确认', ?, 'ai_stub', 0, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(report_date)
    .bind(metrics)
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
