use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use futures::StreamExt;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

use crate::ai::{ChatMessage, CompletionRequest, StreamChunk};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const DISCLAIMER: &str = "以上为示意结果，不构成专业建议。";

const TOOLS: &[(&str, &str)] = &[
    ("summary", "摘要"),
    ("meeting", "会议助手"),
    ("writing.weekly", "周报"),
    ("writing.daily", "日报"),
    ("writing.xhs", "小红书"),
    ("polish", "润色"),
    ("resume_jd", "简历对照"),
    ("rename", "文件命名"),
];

const TONES: &[&str] = &["更专业", "更幽默", "更精简"];
const MAX_CHARS: usize = 32_000;

#[derive(Clone, FromRow)]
struct TaskRow {
    id: String,
    tool_id: String,
    input_kind: String,
    input_text: String,
    input_meta: String,
    output_text: String,
    output_json: String,
    source: String,
    created_at: String,
}

#[derive(Clone, FromRow)]
struct TemplateRow {
    id: String,
    tool_id: String,
    title: String,
    body: String,
    favourite: i64,
    created_at: String,
    updated_at: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/tools", get(list_tools))
        .route("/v1/tools/tasks", get(list_tasks))
        .route("/v1/tools/tasks/{id}", get(get_task))
        .route("/v1/tools/{tool_id}/favourite", put(set_favourite))
        .route("/v1/tools/{tool_id}/run", post(run_tool))
}

fn known_tool(tool_id: &str) -> Result<(), AppError> {
    if TOOLS.iter().any(|(id, _)| *id == tool_id) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!("unknown tool: {tool_id}")))
    }
}

fn count_chars(parts: &[&str]) -> usize {
    parts.iter().map(|part| part.chars().count()).sum()
}

fn require_text(raw: Option<&str>, field: &str) -> Result<String, AppError> {
    let value = raw.unwrap_or("").trim();
    if value.is_empty() {
        return Err(AppError::InvalidRequest(format!("{field} is required")));
    }
    Ok(value.to_string())
}

pub fn extract_pdf_text(raw: &str) -> String {
    let trimmed = raw.trim();
    if !trimmed.starts_with("%PDF") {
        return raw.to_string();
    }
    let mut out = Vec::new();
    let bytes = raw.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'(' {
            i += 1;
            let mut chunk = String::new();
            while i < bytes.len() && bytes[i] != b')' {
                chunk.push(bytes[i] as char);
                i += 1;
            }
            if !chunk.trim().is_empty() {
                out.push(chunk);
            }
        }
        i = i.saturating_add(1);
    }
    if out.is_empty() {
        raw.to_string()
    } else {
        out.join("，")
    }
}

fn extract_todos(text: &str) -> Vec<Value> {
    let mut todos = Vec::new();
    for part in text.split(|c: char| "、。；;\n，".contains(c)) {
        let item = part.trim().trim_start_matches('并').trim();
        if item.chars().count() >= 2 {
            todos.push(json!({ "text": item, "done": false }));
        }
        if todos.len() >= 5 {
            break;
        }
    }
    if todos.is_empty() {
        todos.push(json!({ "text": "整理要点", "done": false }));
    }
    todos
}

fn split_topics(text: &str) -> Vec<String> {
    let mut topics = Vec::new();
    for part in text.split(|c: char| "。；;\n".contains(c)) {
        let item = part.trim().trim_end_matches('，').trim();
        if item.chars().count() >= 2 {
            topics.push(item.to_string());
        }
        if topics.len() >= 6 {
            break;
        }
    }
    if topics.is_empty() {
        topics.push("待讨论事项".into());
    }
    topics
}

fn sanitize_filename(name: &str) -> String {
    let (stem, ext) = match name.rsplit_once('.') {
        Some((stem, ext)) if !ext.is_empty() && ext.chars().all(|c| c.is_ascii_alphanumeric()) => {
            (stem, format!(".{ext}"))
        }
        _ => (name, String::new()),
    };
    let mut cleaned = String::new();
    for ch in stem.chars() {
        if ch.is_ascii_alphanumeric() || ('\u{4e00}'..='\u{9fff}').contains(&ch) {
            cleaned.push(ch);
        } else if !cleaned.ends_with('-') && !cleaned.is_empty() {
            cleaned.push('-');
        }
    }
    let cleaned = cleaned.trim_matches('-');
    if cleaned.is_empty() {
        format!("文件{ext}")
    } else {
        format!("{cleaned}{ext}")
    }
}

fn chunk_chars(text: &str, size: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        current.push(ch);
        if current.chars().count() >= size {
            chunks.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    if chunks.is_empty() {
        chunks.push(String::new());
    }
    chunks
}

fn sse_delta(text: String) -> String {
    qingxin_ai_gateway::encode_sse(&qingxin_ai_gateway::ChatChunk::Delta { text })
}

pub fn sse_error(code: &str, message: &str) -> String {
    let payload = json!({ "error": { "code": code, "message": message } });
    format!("event: error\ndata: {payload}\n\n")
}

fn task_public(row: &TaskRow) -> Value {
    json!({
        "id": row.id,
        "tool_id": row.tool_id,
        "input_kind": row.input_kind,
        "input_text": row.input_text,
        "input_meta": serde_json::from_str::<Value>(&row.input_meta).unwrap_or(json!({})),
        "output_text": row.output_text,
        "output_json": serde_json::from_str::<Value>(&row.output_json).unwrap_or(json!({})),
        "source": row.source,
        "disclaimer": DISCLAIMER,
        "created_at": row.created_at,
    })
}

#[derive(Deserialize)]
struct RunBody {
    input_kind: Option<String>,
    text: Option<String>,
    url: Option<String>,
    filename: Option<String>,
    pdf_base64: Option<String>,
    resume: Option<String>,
    jd: Option<String>,
    filenames: Option<Vec<String>>,
    tone: Option<String>,
    step: Option<String>,
    topics: Option<Vec<String>>,
}

struct Prepared {
    tool_id: String,
    input_kind: String,
    input_text: String,
    input_meta: Value,
    prompt: String,
    fallback_text: String,
    fallback_json: Value,
}

fn prepare(tool_id: &str, body: RunBody, prior_topics: Vec<String>) -> Result<Prepared, AppError> {
    known_tool(tool_id)?;
    match tool_id {
        "summary" => prepare_summary(body),
        "meeting" => prepare_meeting(body, prior_topics),
        "writing.weekly" | "writing.daily" | "writing.xhs" => prepare_writing(tool_id, body),
        "polish" => prepare_polish(body),
        "resume_jd" => prepare_resume_jd(body),
        "rename" => prepare_rename(body),
        _ => Err(AppError::InvalidRequest(format!("unknown tool: {tool_id}"))),
    }
}

fn prepare_summary(body: RunBody) -> Result<Prepared, AppError> {
    let input_kind = body.input_kind.unwrap_or_else(|| "text".into());
    if !matches!(input_kind.as_str(), "text" | "url" | "pdf") {
        return Err(AppError::InvalidRequest(format!(
            "unknown input_kind: {input_kind}"
        )));
    }
    let mut text = body.text.unwrap_or_default();
    if let Some(pdf) = body.pdf_base64.as_deref() {
        if let Ok(bytes) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pdf) {
            if let Ok(decoded) = String::from_utf8(bytes) {
                text = decoded;
            }
        }
    }
    let extracted = if input_kind == "pdf" {
        extract_pdf_text(&text)
    } else {
        text.trim().to_string()
    };
    let url = body.url.clone().unwrap_or_default();
    if input_kind == "url" {
        let url = require_text(Some(url.as_str()), "url")?;
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            return Err(AppError::InvalidRequest("url must be http(s)".into()));
        }
    }
    if extracted.trim().is_empty() && input_kind != "url" {
        return Err(AppError::InvalidRequest("text is required".into()));
    }
    if count_chars(&[&extracted, &url]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let filename = body.filename.clone().unwrap_or_default();
    let todos = extract_todos(if extracted.trim().is_empty() {
        "打开链接并记下待办"
    } else {
        &extracted
    });
    let summary = if extracted.trim().is_empty() {
        format!("【示意摘要】来自 {url} 的页面要点。")
    } else {
        format!(
            "【示意摘要】{}。待办已列出。",
            extracted.chars().take(80).collect::<String>()
        )
    };
    Ok(Prepared {
        tool_id: "summary".into(),
        input_kind,
        input_text: extracted.clone(),
        input_meta: json!({
            "url": body.url,
            "filename": body.filename,
        }),
        prompt: format!(
            "请用中文摘要以下内容，并列出待办。filename={filename} url={url}\n{extracted}"
        ),
        fallback_json: json!({ "summary": summary, "todos": todos }),
        fallback_text: summary,
    })
}

fn prepare_meeting(body: RunBody, prior_topics: Vec<String>) -> Result<Prepared, AppError> {
    let transcript = require_text(body.text.as_deref(), "text")?;
    if count_chars(&[&transcript]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let step = body.step.unwrap_or_else(|| "topics".into());
    if step != "topics" && step != "decisions" {
        return Err(AppError::InvalidRequest(format!("unknown step: {step}")));
    }
    let topics = if let Some(from_body) = body.topics.filter(|items| !items.is_empty()) {
        from_body
    } else if step == "decisions" {
        if prior_topics.is_empty() {
            return Err(AppError::InvalidRequest("topics are required".into()));
        }
        prior_topics
    } else {
        split_topics(&transcript)
    };
    let decisions: Vec<String> = if step == "decisions" {
        topics
            .iter()
            .map(|topic| format!("决定：{topic}"))
            .collect()
    } else {
        Vec::new()
    };
    let fallback_text = if step == "decisions" {
        format!("【会议决策】{}", decisions.join("；"))
    } else {
        format!("【会议议题】{}", topics.join("；"))
    };
    Ok(Prepared {
        tool_id: "meeting".into(),
        input_kind: "transcript".into(),
        input_text: transcript.clone(),
        input_meta: json!({ "step": step, "topics": topics }),
        prompt: format!("请从会议记录提取{step}：\n{transcript}"),
        fallback_json: json!({ "topics": topics, "decisions": decisions, "step": step }),
        fallback_text,
    })
}

fn prepare_writing(tool_id: &str, body: RunBody) -> Result<Prepared, AppError> {
    let notes = require_text(body.text.as_deref(), "text")?;
    if count_chars(&[&notes]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let label = match tool_id {
        "writing.weekly" => "周报",
        "writing.daily" => "日报",
        _ => "小红书",
    };
    let fallback_text = format!("【{label}】{notes}。此为示意文案。");
    Ok(Prepared {
        tool_id: tool_id.into(),
        input_kind: "text".into(),
        input_text: notes.clone(),
        input_meta: json!({ "kind": label }),
        prompt: format!("请写成{label}：\n{notes}"),
        fallback_json: json!({ "text": fallback_text }),
        fallback_text,
    })
}

fn prepare_polish(body: RunBody) -> Result<Prepared, AppError> {
    let text = require_text(body.text.as_deref(), "text")?;
    if count_chars(&[&text]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let tone = body.tone.unwrap_or_else(|| "更专业".into());
    if !TONES.contains(&tone.as_str()) {
        return Err(AppError::InvalidRequest(format!("unknown tone: {tone}")));
    }
    let fallback_text = format!("（{tone}）{text}。此为示意润色。");
    Ok(Prepared {
        tool_id: "polish".into(),
        input_kind: "text".into(),
        input_text: text.clone(),
        input_meta: json!({ "tone": tone }),
        prompt: format!("请用{tone}润色：\n{text}"),
        fallback_json: json!({ "text": fallback_text }),
        fallback_text,
    })
}

fn prepare_resume_jd(body: RunBody) -> Result<Prepared, AppError> {
    let resume = require_text(body.resume.as_deref(), "resume")?;
    let jd = require_text(body.jd.as_deref(), "jd")?;
    if count_chars(&[&resume, &jd]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let shared = resume
        .chars()
        .filter(|ch| !ch.is_whitespace() && jd.contains(*ch))
        .count();
    let score = ((shared.min(40) as i64) * 2 + 20).min(100);
    let matches = vec!["Rust".to_string(), "前端".to_string()]
        .into_iter()
        .filter(|item| resume.contains(item.as_str()) || jd.contains(item.as_str()))
        .collect::<Vec<_>>();
    let matches = if matches.is_empty() {
        vec!["相关经验".into()]
    } else {
        matches
    };
    let gaps = vec!["补充量化结果".to_string()];
    let fallback_text = format!("【对照】匹配度 {score}。此为示意，不构成职业建议。");
    Ok(Prepared {
        tool_id: "resume_jd".into(),
        input_kind: "resume_jd".into(),
        input_text: format!("{resume}\n---\n{jd}"),
        input_meta: json!({ "resume": resume, "jd": jd }),
        prompt: format!("请对照简历与职位：\n简历：{resume}\n职位：{jd}"),
        fallback_json: json!({
            "score": score,
            "matches": matches,
            "gaps": gaps,
            "advice": "把重合技能写进首段。"
        }),
        fallback_text,
    })
}

fn prepare_rename(body: RunBody) -> Result<Prepared, AppError> {
    let filenames = body.filenames.unwrap_or_default();
    if filenames.is_empty() || filenames.iter().all(|name| name.trim().is_empty()) {
        return Err(AppError::InvalidRequest("filenames is required".into()));
    }
    let joined = filenames.join("\n");
    if count_chars(&[&joined]) > MAX_CHARS {
        return Err(AppError::InvalidRequest("input is too long".into()));
    }
    let suggestions: Vec<Value> = filenames
        .iter()
        .map(|original| {
            let suggested = sanitize_filename(original);
            json!({
                "original": original,
                "suggested": suggested,
                "reason": "去掉空格与序号，便于检索。"
            })
        })
        .collect();
    let fallback_text = suggestions
        .iter()
        .filter_map(|item| item["suggested"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    Ok(Prepared {
        tool_id: "rename".into(),
        input_kind: "files".into(),
        input_text: joined,
        input_meta: json!({ "filenames": filenames }),
        prompt: format!("请建议更清晰的文件名：\n{}", filenames.join("\n")),
        fallback_json: json!({ "suggestions": suggestions }),
        fallback_text,
    })
}

async fn latest_meeting_topics(state: &AppState, user_id: &str) -> Result<Vec<String>, AppError> {
    let row = sqlx::query_as::<_, TaskRow>(
        "SELECT id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at
         FROM ai_tasks WHERE user_id = ? AND tool_id = 'meeting' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(row
        .and_then(|row| serde_json::from_str::<Value>(&row.output_json).ok())
        .and_then(|value| {
            value["topics"].as_array().map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_string))
                    .collect::<Vec<_>>()
            })
        })
        .unwrap_or_default())
}

async fn insert_task(
    state: &AppState,
    user_id: &str,
    prepared: &Prepared,
    output_text: &str,
    output_json: &Value,
    source: &str,
) -> Result<TaskRow, AppError> {
    let id = new_id();
    let now = now_rfc3339();
    let meta = prepared.input_meta.to_string();
    let output_json_text = output_json.to_string();
    sqlx::query(
        "INSERT INTO ai_tasks (id, user_id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&prepared.tool_id)
    .bind(&prepared.input_kind)
    .bind(&prepared.input_text)
    .bind(&meta)
    .bind(output_text)
    .bind(&output_json_text)
    .bind(source)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(TaskRow {
        id,
        tool_id: prepared.tool_id.clone(),
        input_kind: prepared.input_kind.clone(),
        input_text: prepared.input_text.clone(),
        input_meta: meta,
        output_text: output_text.to_string(),
        output_json: output_json_text,
        source: source.to_string(),
        created_at: now,
    })
}

async fn list_tools(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let fav_rows = sqlx::query_as::<_, TemplateRow>(
        "SELECT id, tool_id, title, body, favourite, created_at, updated_at
         FROM templates WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let recent = sqlx::query_scalar::<_, String>(
        "SELECT tool_id FROM ai_tasks WHERE user_id = ? GROUP BY tool_id ORDER BY MAX(rowid) DESC",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let items: Vec<Value> = TOOLS
        .iter()
        .map(|(id, name)| {
            let favourite = fav_rows
                .iter()
                .any(|row| row.tool_id == *id && row.favourite != 0);
            json!({ "id": id, "name": name, "favourite": favourite })
        })
        .collect();
    let favourites: Vec<String> = fav_rows
        .into_iter()
        .filter(|row| row.favourite != 0)
        .map(|row| row.tool_id)
        .collect();
    Ok(Json(json!({
        "items": items,
        "recent": recent,
        "favourites": favourites,
    })))
}

#[derive(Deserialize)]
struct FavouriteBody {
    favourite: bool,
}

async fn set_favourite(
    State(state): State<AppState>,
    user: AuthUser,
    Path(tool_id): Path<String>,
    Json(body): Json<FavouriteBody>,
) -> Result<Json<Value>, AppError> {
    known_tool(&tool_id)?;
    let now = now_rfc3339();
    let title = TOOLS
        .iter()
        .find(|(id, _)| *id == tool_id)
        .map(|(_, name)| (*name).to_string())
        .unwrap_or_else(|| tool_id.clone());
    sqlx::query(
        "INSERT INTO templates (id, user_id, tool_id, title, body, favourite, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', ?, ?, ?)
         ON CONFLICT(user_id, tool_id) DO UPDATE SET favourite = excluded.favourite, updated_at = excluded.updated_at",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&user.user_id)
    .bind(&tool_id)
    .bind(&title)
    .bind(i64::from(body.favourite))
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "tool_id": tool_id,
        "favourite": body.favourite,
    })))
}

#[derive(Deserialize)]
struct TaskQuery {
    tool_id: Option<String>,
}

async fn list_tasks(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<TaskQuery>,
) -> Result<Json<Value>, AppError> {
    if let Some(tool_id) = query.tool_id.as_deref() {
        known_tool(tool_id)?;
    }
    let rows = if let Some(tool_id) = query.tool_id.as_deref() {
        sqlx::query_as::<_, TaskRow>(
            "SELECT id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at
             FROM ai_tasks WHERE user_id = ? AND tool_id = ? ORDER BY rowid DESC",
        )
        .bind(&user.user_id)
        .bind(tool_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    } else {
        sqlx::query_as::<_, TaskRow>(
            "SELECT id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at
             FROM ai_tasks WHERE user_id = ? ORDER BY rowid DESC",
        )
        .bind(&user.user_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    };
    Ok(Json(json!({
        "items": rows.iter().map(task_public).collect::<Vec<_>>()
    })))
}

async fn get_task(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = sqlx::query_as::<_, TaskRow>(
        "SELECT id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at
         FROM ai_tasks WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(&user.user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)?;
    Ok(Json(task_public(&row)))
}

async fn run_tool(
    State(state): State<AppState>,
    user: AuthUser,
    Path(tool_id): Path<String>,
    Json(body): Json<RunBody>,
) -> Result<Response, AppError> {
    let prior = if tool_id == "meeting" {
        latest_meeting_topics(&state, &user.user_id).await?
    } else {
        Vec::new()
    };
    let prepared = prepare(&tool_id, body, prior)?;
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: prepared.prompt.clone(),
        }],
        model: Some("qingxin-tools".into()),
    };
    let started = state.ai.stream(&user.user_id, req).await;
    // Unconfigured *and* provider failure (Ollama down in CI) use fallback_text
    // inside the spawn. Returning 503 here skipped the 示意 SSE the workbench
    // and live-API Playwright expect.

    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Result<String, std::io::Error>>();
    let state_clone = state.clone();
    let user_id = user.user_id.clone();
    tokio::spawn(async move {
        let mut collected = String::new();
        let mut source = "mock";
        if let Ok(mut stream) = started {
            while let Some(item) = stream.next().await {
                match item {
                    Ok(StreamChunk::Delta { text }) if !text.is_empty() => {
                        collected.push_str(&text);
                        source = "gateway";
                        let _ = tx.send(Ok(sse_delta(text)));
                    }
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
        }
        if collected.trim().is_empty() {
            source = "mock";
            collected = prepared.fallback_text.clone();
            for chunk in chunk_chars(&collected, 12) {
                let _ = tx.send(Ok(sse_delta(chunk)));
            }
        }
        let output_json = if source == "mock" {
            prepared.fallback_json.clone()
        } else if let Ok(parsed) = serde_json::from_str::<Value>(&collected) {
            parsed
        } else {
            json!({ "text": collected })
        };
        match insert_task(
            &state_clone,
            &user_id,
            &prepared,
            &collected,
            &output_json,
            source,
        )
        .await
        {
            Ok(row) => {
                let mut payload = task_public(&row);
                if let Some(obj) = payload.as_object_mut() {
                    obj.insert("disclaimer".into(), json!(DISCLAIMER));
                }
                let _ = tx.send(Ok(format!("event: result\ndata: {payload}\n\n")));
            }
            Err(_) => {
                let _ = tx.send(Ok(sse_error("unavailable", "保存失败")));
            }
        }
        let _ = tx.send(Ok("data: [DONE]\n\n".into()));
    });

    let body_stream = futures::stream::unfold(rx, |mut rx| async move {
        rx.recv().await.map(|item| (item, rx))
    });
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header("x-accel-buffering", "no")
        .body(Body::from_stream(body_stream))
        .map_err(|err| AppError::Unavailable(err.to_string()))
}

pub async fn export_tasks(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, TaskRow>(
        "SELECT id, tool_id, input_kind, input_text, input_meta, output_text, output_json, source, created_at
         FROM ai_tasks WHERE user_id = ? ORDER BY rowid DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(task_public).collect())
}

pub async fn export_templates(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, TemplateRow>(
        "SELECT id, tool_id, title, body, favourite, created_at, updated_at FROM templates WHERE user_id = ?",
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
                "tool_id": row.tool_id,
                "title": row.title,
                "body": row.body,
                "favourite": row.favourite != 0,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            })
        })
        .collect())
}
