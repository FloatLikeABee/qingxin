use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Datelike, Duration, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const DISCLAIMER: &str = "以上为示意陪伴文字，不构成医疗建议、诊断或治疗。";

const EMOJIS: &[(&str, i64)] = &[
    ("😄", 5),
    ("🙂", 4),
    ("😐", 3),
    ("😔", 2),
    ("😢", 1),
    ("😡", 2),
    ("😰", 2),
    ("🥰", 5),
];

const TAGS: &[&str] = &[
    "工作", "家庭", "睡眠", "健康", "社交", "学习", "天气", "运动", "独处", "压力",
];

const KINDS: &[&str] = &["breathe", "noise", "story", "timer"];

#[derive(Clone, FromRow)]
struct MoodRow {
    id: String,
    emoji: String,
    score: i64,
    tags_json: String,
    note_encrypted: Option<Vec<u8>>,
    created_at: String,
}

#[derive(Serialize)]
pub struct MoodLogPublic {
    pub id: String,
    pub emoji: String,
    pub score: i64,
    pub tags: Vec<String>,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Clone, FromRow)]
struct SessionRow {
    id: String,
    kind: String,
    duration_sec: i64,
    payload_json: String,
    started_at: String,
    ended_at: Option<String>,
}

impl MoodRow {
    fn public(&self, crypto: &FieldCrypto) -> Result<MoodLogPublic, AppError> {
        Ok(MoodLogPublic {
            id: self.id.clone(),
            emoji: self.emoji.clone(),
            score: self.score,
            tags: parse_tags(&self.tags_json),
            note: decrypt_note(crypto, self.note_encrypted.as_deref())?,
            created_at: self.created_at.clone(),
        })
    }
}

fn parse_tags(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn decrypt_note(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Result<Option<String>, AppError> {
    let Some(bytes) = blob else {
        return Ok(None);
    };
    let plain = crypto.decrypt(bytes)?;
    Ok(Some(String::from_utf8(plain).map_err(|_| {
        AppError::Unavailable("note decode failed".into())
    })?))
}

fn score_for(emoji: &str) -> Result<i64, AppError> {
    EMOJIS
        .iter()
        .find(|(face, _)| *face == emoji)
        .map(|(_, score)| *score)
        .ok_or_else(|| AppError::InvalidRequest("emoji is not in the catalog".into()))
}

fn validate_tags(tags: &[String]) -> Result<(), AppError> {
    for tag in tags {
        if !TAGS.contains(&tag.as_str()) {
            return Err(AppError::InvalidRequest(format!("unknown tag: {tag}")));
        }
    }
    Ok(())
}

fn normalize_note(note: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(raw) = note.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if raw.chars().count() >= 100 {
        return Err(AppError::InvalidRequest(
            "note must be shorter than 100 characters".into(),
        ));
    }
    Ok(Some(raw.to_string()))
}

pub fn deterministic_insight(emoji: &str, tags: &[String]) -> String {
    let mut ordered = tags.to_vec();
    ordered.sort();
    let score = score_for(emoji).unwrap_or(3);
    let tone = if score <= 2 {
        "今天有些沉重。先允许自己慢一点，比责怪自己更有用。"
    } else if score == 3 {
        "这一笔很平静。把呼吸放慢一点，就已经在照顾自己。"
    } else {
        "这份轻松值得被看见。把它轻轻放进今天即可。"
    };
    let extra = if ordered.iter().any(|tag| tag == "睡眠") {
        "睡眠不足时，情绪会先说话。"
    } else if ordered.iter().any(|tag| tag == "工作") {
        "工作可以告一段落，人不需要一直在线。"
    } else {
        "你已经写下了这一刻，这就够了。"
    };
    format!("{tone}{extra}")
}

pub fn deterministic_monthly_summary(logs: &[MoodLogPublic]) -> String {
    if logs.is_empty() {
        return "这个月还没有足够的记录。先写下今天的一笔就好。".into();
    }
    let mut counts = std::collections::BTreeMap::<String, i64>::new();
    let mut total = 0.0;
    for log in logs {
        total += log.score as f64;
        for tag in &log.tags {
            *counts.entry(tag.clone()).or_insert(0) += 1;
        }
    }
    let avg = total / logs.len() as f64;
    let top = counts
        .into_iter()
        .max_by_key(|(_, n)| *n)
        .map(|(tag, _)| tag)
        .unwrap_or_else(|| "日常".into());
    format!(
        "这个月记下了{}笔，平均心情约{:.1}。最常出现的标签是{}。",
        logs.len(),
        avg,
        top
    )
}

pub fn catalog() -> Value {
    json!({
        "sounds": [
            {"id": "rain", "name": "雨声"},
            {"id": "waves", "name": "海浪"},
            {"id": "fan", "name": "风扇"},
            {"id": "fire", "name": "篝火"},
            {"id": "white", "name": "白噪音"}
        ],
        "stories": [
            {
                "id": "lantern",
                "title": "河岸的灯",
                "body": "有人在河岸挂了一盏很小的灯。风来的时候，灯只是轻轻晃，并不急着证明自己有多亮。你也可以这样：把今天放下，让光自己停在附近。"
            },
            {
                "id": "cloud",
                "title": "云停了一会儿",
                "body": "傍晚的云走得很慢，像是把一天的声音都裹进棉花里。窗开一条缝就够了。呼吸进去，再慢慢送出去，故事就可以在这里结束。"
            }
        ]
    })
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/mood/logs", get(list_logs).post(create_log))
        .route("/v1/mood/trends", get(trends))
        .route("/v1/mood/insights", post(insight))
        .route("/v1/mood/summaries/monthly", get(monthly_summary))
        .route("/v1/meditation/catalog", get(get_catalog))
        .route(
            "/v1/meditation/sessions",
            get(list_sessions).post(create_session),
        )
}

#[derive(Deserialize)]
struct CreateLogBody {
    id: Option<String>,
    emoji: String,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    tag: Option<String>,
    from: Option<String>,
    to: Option<String>,
}

#[derive(Deserialize)]
struct TrendQuery {
    period: String,
    tag: Option<String>,
}

#[derive(Deserialize)]
struct InsightBody {
    mood_log_id: Option<String>,
    emoji: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct MonthQuery {
    month: String,
}

#[derive(Deserialize)]
struct CreateSessionBody {
    kind: String,
    duration_sec: i64,
    #[serde(default)]
    payload: Value,
}

async fn create_log(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateLogBody>,
) -> Result<(StatusCode, Json<MoodLogPublic>), AppError> {
    let score = score_for(&body.emoji)?;
    validate_tags(&body.tags)?;
    let note = normalize_note(body.note.as_deref())?;
    let id =
        match body.id.as_deref() {
            Some(raw) if !raw.trim().is_empty() => Uuid::parse_str(raw.trim())
                .map(|u| u.to_string())
                .map_err(|_| AppError::InvalidRequest("id must be a uuid".into()))?,
            _ => new_id(),
        };
    let blob = match note.as_deref() {
        Some(text) => Some(state.crypto.encrypt(text.as_bytes())?),
        None => None,
    };
    let now = now_rfc3339();
    let tags_json = serde_json::to_string(&body.tags).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO mood_logs (id, user_id, emoji, score, tags_json, note_encrypted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&body.emoji)
    .bind(score)
    .bind(&tags_json)
    .bind(blob)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = load_log(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public(&state.crypto)?)))
}

async fn load_log(state: &AppState, user_id: &str, id: &str) -> Result<MoodRow, AppError> {
    sqlx::query_as::<_, MoodRow>(
        "SELECT id, emoji, score, tags_json, note_encrypted, created_at
         FROM mood_logs WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_rows(
    state: &AppState,
    user_id: &str,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<MoodRow>, AppError> {
    sqlx::query_as::<_, MoodRow>(
        "SELECT id, emoji, score, tags_json, note_encrypted, created_at
         FROM mood_logs
         WHERE user_id = ?
           AND (? IS NULL OR created_at >= ?)
           AND (? IS NULL OR created_at <= ?)
         ORDER BY created_at DESC",
    )
    .bind(user_id)
    .bind(from)
    .bind(from)
    .bind(to)
    .bind(to)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_mood(state: &AppState, user_id: &str) -> Result<Vec<MoodLogPublic>, AppError> {
    let rows = list_rows(state, user_id, None, None).await?;
    rows.iter().map(|row| row.public(&state.crypto)).collect()
}

async fn list_logs(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<Value>, AppError> {
    let rows = list_rows(
        &state,
        &user.user_id,
        query.from.as_deref(),
        query.to.as_deref(),
    )
    .await?;
    let mut items = Vec::new();
    for row in rows {
        let public = row.public(&state.crypto)?;
        if let Some(tag) = query.tag.as_deref() {
            if !public.tags.iter().any(|item| item == tag) {
                continue;
            }
        }
        items.push(public);
    }
    Ok(Json(json!({ "items": items })))
}

#[derive(Serialize)]
struct TrendPoint {
    date: String,
    average_score: f64,
    count: i64,
}

fn trend_points(logs: &[MoodLogPublic], period: &str) -> Result<Vec<TrendPoint>, AppError> {
    let days = match period {
        "week" => 7,
        "month" => 30,
        _ => {
            return Err(AppError::InvalidRequest(
                "period must be week or month".into(),
            ))
        }
    };
    let start = (Utc::now() - Duration::days(days - 1))
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .expect("midnight")
        .and_utc();
    let mut buckets = std::collections::BTreeMap::<String, (f64, i64)>::new();
    for log in logs {
        let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&log.created_at) else {
            continue;
        };
        if ts < start {
            continue;
        }
        let day = ts
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Secs, true)[..10]
            .to_string();
        let entry = buckets.entry(day).or_insert((0.0, 0));
        entry.0 += log.score as f64;
        entry.1 += 1;
    }
    Ok(buckets
        .into_iter()
        .map(|(date, (sum, count))| TrendPoint {
            date,
            average_score: sum / count as f64,
            count,
        })
        .collect())
}

async fn public_logs(
    state: &AppState,
    user_id: &str,
    tag: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<MoodLogPublic>, AppError> {
    let rows = list_rows(state, user_id, from, to).await?;
    let mut items = Vec::new();
    for row in rows {
        let public = row.public(&state.crypto)?;
        if let Some(tag) = tag {
            if !public.tags.iter().any(|item| item == tag) {
                continue;
            }
        }
        items.push(public);
    }
    Ok(items)
}

async fn trends(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<TrendQuery>,
) -> Result<Json<Value>, AppError> {
    let logs = public_logs(&state, &user.user_id, query.tag.as_deref(), None, None).await?;
    let points = trend_points(&logs, &query.period)?;
    Ok(Json(json!({ "period": query.period, "points": points })))
}

async fn complete_or_mock(
    state: &AppState,
    user_id: &str,
    prompt: String,
    fallback: String,
) -> Result<(String, &'static str), AppError> {
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: prompt,
        }],
        model: Some("qingxin-mood".into()),
    };
    match state.ai.complete(user_id, req).await {
        Ok(done) if !done.content.trim().is_empty() => Ok((done.content, "gateway")),
        Ok(_) | Err(AiError::Unconfigured) => Ok((fallback, "mock")),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}

async fn insight(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<InsightBody>,
) -> Result<Json<Value>, AppError> {
    let (emoji, tags, note) = if let Some(id) = body.mood_log_id.as_deref() {
        let row = load_log(&state, &user.user_id, id).await?;
        let public = row.public(&state.crypto)?;
        (public.emoji, public.tags, public.note.unwrap_or_default())
    } else {
        let emoji = body
            .emoji
            .as_deref()
            .ok_or_else(|| AppError::InvalidRequest("emoji or mood_log_id is required".into()))?;
        score_for(emoji)?;
        validate_tags(&body.tags)?;
        (
            emoji.to_string(),
            body.tags.clone(),
            body.note.unwrap_or_default(),
        )
    };
    let fallback = deterministic_insight(&emoji, &tags);
    let prompt = format!("emoji={emoji};tags={};note={note}", {
        let mut ordered = tags.clone();
        ordered.sort();
        ordered.join(",")
    });
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "text": text,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

fn month_bounds(month: &str) -> Result<(String, String), AppError> {
    let start = NaiveDate::parse_from_str(&format!("{month}-01"), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("month must be YYYY-MM".into()))?;
    let end = if start.month() == 12 {
        NaiveDate::from_ymd_opt(start.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(start.year(), start.month() + 1, 1)
    }
    .ok_or_else(|| AppError::InvalidRequest("month is invalid".into()))?;
    Ok((
        format!("{month}-01T00:00:00Z"),
        format!("{}T00:00:00Z", end.format("%Y-%m-%d")),
    ))
}

async fn monthly_summary(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<MonthQuery>,
) -> Result<Json<Value>, AppError> {
    let (from, to) = month_bounds(&query.month)?;
    let logs = public_logs(&state, &user.user_id, None, Some(&from), Some(&to)).await?;
    let fallback = deterministic_monthly_summary(&logs);
    let prompt = format!("month={};count={}", query.month, logs.len());
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "month": query.month,
        "text": text,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn get_catalog(_user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(catalog()))
}

async fn create_session(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateSessionBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    if !KINDS.contains(&body.kind.as_str()) {
        return Err(AppError::InvalidRequest("unknown meditation kind".into()));
    }
    if body.duration_sec < 0 {
        return Err(AppError::InvalidRequest("duration_sec must be >= 0".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    let payload = if body.payload.is_null() {
        json!({})
    } else {
        body.payload
    };
    sqlx::query(
        "INSERT INTO meditation_sessions
            (id, user_id, kind, duration_sec, payload_json, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&body.kind)
    .bind(body.duration_sec)
    .bind(payload.to_string())
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": id,
            "kind": body.kind,
            "duration_sec": body.duration_sec,
            "payload": payload,
            "started_at": now,
            "ended_at": now
        })),
    ))
}

pub async fn export_sessions(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, SessionRow>(
        "SELECT id, kind, duration_sec, payload_json, started_at, ended_at
         FROM meditation_sessions WHERE user_id = ? ORDER BY started_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "kind": row.kind,
                "duration_sec": row.duration_sec,
                "payload": serde_json::from_str::<Value>(&row.payload_json).unwrap_or(json!({})),
                "started_at": row.started_at,
                "ended_at": row.ended_at
            })
        })
        .collect())
}

async fn list_sessions(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_sessions(&state, &user.user_id).await?
    })))
}
