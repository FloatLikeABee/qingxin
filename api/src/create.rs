use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const DISCLAIMER: &str = "以上为示意文字，不构成专业文案或营销建议。";

const PLATFORMS: &[&str] = &["小红书", "公众号", "抖音", "周报"];
const TONES: &[&str] = &["更专业", "更幽默", "更精简"];
const LENGTHS: &[&str] = &["短", "中", "长"];
const SNIPPET_KINDS: &[&str] = &["金句", "案例", "过渡"];

#[derive(Clone, FromRow)]
struct CreationRow {
    id: String,
    platform: String,
    title: Option<String>,
    prompt_params: String,
    generated_content: String,
    final_content: String,
    versions_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, FromRow)]
struct SnippetRow {
    id: String,
    content: String,
    kind: String,
    tags_json: String,
    usage_count: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct SnippetPublic {
    id: String,
    content: String,
    kind: String,
    tags: Vec<String>,
    usage_count: i64,
    created_at: String,
    updated_at: String,
}

impl SnippetRow {
    fn public(self) -> SnippetPublic {
        let tags = serde_json::from_str(&self.tags_json).unwrap_or_default();
        SnippetPublic {
            id: self.id,
            content: self.content,
            kind: self.kind,
            tags,
            usage_count: self.usage_count,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn creation_public(row: &CreationRow) -> Value {
    let prompt_params: Value = serde_json::from_str(&row.prompt_params).unwrap_or(json!({}));
    let versions: Value = serde_json::from_str(&row.versions_json).unwrap_or(json!([]));
    json!({
        "id": row.id,
        "platform": row.platform,
        "title": row.title,
        "prompt_params": prompt_params,
        "generated_content": row.generated_content,
        "final_content": row.final_content,
        "versions": versions,
        "created_at": row.created_at,
        "updated_at": row.updated_at
    })
}

fn templates() -> Vec<Value> {
    vec![
        json!({
            "id": "xhs-daily",
            "platform": "小红书",
            "name": "日常种草",
            "body": "标题：{{主题}}\n封面要点：{{关键词}}\n正文用三句把体验写清楚，收在一句邀请。"
        }),
        json!({
            "id": "mp-essay",
            "platform": "公众号",
            "name": "深度长文",
            "body": "标题：{{主题}}\n导语点出{{关键词}}\n分三段：现象、方法、小结。"
        }),
        json!({
            "id": "dy-script",
            "platform": "抖音",
            "name": "口播脚本",
            "body": "钩子：{{主题}}\n口播 20 秒讲清{{关键词}}\n结尾给行动指令。"
        }),
        json!({
            "id": "weekly-note",
            "platform": "周报",
            "name": "一周复盘",
            "body": "主题：{{主题}}\n本周关键词：{{关键词}}\n成果 / 卡点 / 下周三件事。"
        }),
    ]
}

fn inspiration() -> Vec<Value> {
    vec![
        json!({ "id": "ins-1", "topic": "阳台种菜", "platform": "小红书", "hook": "一块托盘也能长出夏天。" }),
        json!({ "id": "ins-2", "topic": "午睡十分钟", "platform": "公众号", "hook": "把午后还给自己。" }),
        json!({ "id": "ins-3", "topic": "通勤英语", "platform": "抖音", "hook": "一站路，一句新表达。" }),
        json!({ "id": "ins-4", "topic": "季度复盘", "platform": "周报", "hook": "把忙过的日子排成三列。" }),
    ]
}

pub fn deterministic_generate(
    platform: &str,
    topic: &str,
    keywords: &[String],
    tone: &str,
    length: &str,
) -> String {
    let mut ordered = keywords.to_vec();
    ordered.sort();
    let joined = if ordered.is_empty() {
        "日常".into()
    } else {
        ordered.join("、")
    };
    format!("【{platform}·{tone}·{length}】{topic}：把{joined}写成可收藏的日常。此为示意文案。")
}

pub fn deterministic_titles(topic: &str) -> Vec<String> {
    (1..=10)
        .map(|n| match n {
            1 => format!("{topic}，我记下的第一句"),
            2 => format!("关于{topic}的十个小观察"),
            3 => format!("{topic}｜不想写得很满"),
            4 => format!("把{topic}说给明天的自己"),
            5 => format!("{topic}其实很轻"),
            6 => format!("一份{topic}备忘"),
            7 => format!("{topic}：从一句开始"),
            8 => format!("今晚只写{topic}"),
            9 => format!("{topic}的安静版本"),
            _ => format!("{topic}｜灵感10"),
        })
        .collect()
}

pub fn deterministic_polish(text: &str, tone: &str) -> String {
    format!("（{tone}）{text}。此为示意润色。")
}

pub fn deterministic_outline(topic: &str) -> Value {
    let slides = vec![
        json!({ "heading": "封面", "bullets": [topic, "示意大纲，可改标题"] }),
        json!({ "heading": "要点", "bullets": ["发生了什么", "为什么值得写", "读者带走一句"] }),
        json!({ "heading": "下一步", "bullets": ["选择一个平台发出", "记下要复用的金句"] }),
    ];
    let markdown = outline_markdown(topic, &slides);
    json!({
        "title": format!("{topic} · 示意大纲"),
        "slides": slides,
        "markdown": markdown
    })
}

fn outline_markdown(title: &str, slides: &[Value]) -> String {
    let mut out = format!("# {title}\n");
    for slide in slides {
        let heading = slide["heading"].as_str().unwrap_or("幻灯片");
        out.push_str(&format!("\n## {heading}\n"));
        if let Some(bullets) = slide["bullets"].as_array() {
            for bullet in bullets {
                if let Some(text) = bullet.as_str() {
                    out.push_str(&format!("- {text}\n"));
                }
            }
        }
    }
    out
}

fn pad_titles(first: String, topic: &str) -> Vec<String> {
    let mut titles = vec![first];
    for item in deterministic_titles(topic) {
        if titles.len() >= 10 {
            break;
        }
        if !titles.contains(&item) {
            titles.push(item);
        }
    }
    while titles.len() < 10 {
        let n = titles.len() + 1;
        titles.push(format!("{topic}｜灵感{n}"));
    }
    titles.truncate(10);
    titles
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/v1/create/creations",
            get(list_creations).post(create_creation),
        )
        .route(
            "/v1/create/creations/{id}",
            get(get_creation).patch(patch_creation),
        )
        .route(
            "/v1/create/snippets",
            get(list_snippets).post(create_snippet),
        )
        .route("/v1/create/snippets/{id}/use", post(use_snippet))
        .route("/v1/create/templates", get(list_templates))
        .route("/v1/create/inspiration", get(list_inspiration))
        .route("/v1/create/generate", post(generate))
        .route("/v1/create/titles", post(titles))
        .route("/v1/create/polish", post(polish))
        .route("/v1/create/outline", post(outline))
}

fn client_or_new_id(raw: Option<&str>) -> Result<String, AppError> {
    match raw {
        Some(value) if !value.trim().is_empty() => Uuid::parse_str(value.trim())
            .map(|id| id.to_string())
            .map_err(|_| AppError::InvalidRequest("id must be a uuid".into())),
        _ => Ok(new_id()),
    }
}

fn require_text(raw: Option<&str>, field: &str) -> Result<String, AppError> {
    let value = raw.map(str::trim).unwrap_or_default();
    if value.is_empty() {
        return Err(AppError::InvalidRequest(format!("{field} is required")));
    }
    Ok(value.to_string())
}

fn validate_platform(platform: &str) -> Result<(), AppError> {
    if PLATFORMS.contains(&platform) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!(
            "unknown platform: {platform}"
        )))
    }
}

fn validate_tone(tone: &str) -> Result<(), AppError> {
    if TONES.contains(&tone) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!("unknown tone: {tone}")))
    }
}

fn validate_length(length: &str) -> Result<(), AppError> {
    if LENGTHS.contains(&length) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!(
            "unknown length: {length}"
        )))
    }
}

fn validate_snippet_kind(kind: &str) -> Result<(), AppError> {
    if SNIPPET_KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!("unknown kind: {kind}")))
    }
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
        model: Some("qingxin-create".into()),
    };
    match state.ai.complete(user_id, req).await {
        Ok(done) if !done.content.trim().is_empty() => Ok((done.content, "gateway")),
        Ok(_) | Err(AiError::Unconfigured) => Ok((fallback, "mock")),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}

#[derive(Deserialize)]
struct CreateCreationBody {
    id: Option<String>,
    platform: String,
    title: Option<String>,
    #[serde(default)]
    prompt_params: Value,
    generated_content: String,
    final_content: Option<String>,
}

#[derive(Deserialize)]
struct PatchCreationBody {
    title: Option<String>,
    generated_content: Option<String>,
    final_content: Option<String>,
    prompt_params: Option<Value>,
}

#[derive(Deserialize)]
struct CreateSnippetBody {
    id: Option<String>,
    content: String,
    kind: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct PlatformQuery {
    platform: Option<String>,
}

#[derive(Deserialize)]
struct GenerateBody {
    platform: String,
    topic: String,
    #[serde(default)]
    keywords: Vec<String>,
    tone: Option<String>,
    length: Option<String>,
    template_id: Option<String>,
}

#[derive(Deserialize)]
struct TitlesBody {
    topic: String,
    platform: Option<String>,
}

#[derive(Deserialize)]
struct PolishBody {
    text: String,
    tone: String,
}

#[derive(Deserialize)]
struct OutlineBody {
    topic: String,
}

fn snapshot(kind: &str, content: &str, at: &str) -> Value {
    json!({ "at": at, "kind": kind, "content": content })
}

fn parse_versions(raw: &str) -> Vec<Value> {
    serde_json::from_str(raw).unwrap_or_default()
}

async fn create_creation(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateCreationBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    validate_platform(&body.platform)?;
    let generated = require_text(Some(&body.generated_content), "generated_content")?;
    let final_content = body
        .final_content
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&generated)
        .to_string();
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| {
            body.prompt_params
                .get("topic")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        });
    let mut versions = vec![snapshot("generate", &generated, &now)];
    if final_content != generated {
        versions.push(snapshot("edit", &final_content, &now));
    }
    let versions = Value::Array(versions).to_string();
    let params = if body.prompt_params.is_null() {
        json!({}).to_string()
    } else {
        body.prompt_params.to_string()
    };
    let inserted = sqlx::query(
        "INSERT INTO creations
            (id, user_id, platform, title, prompt_params, generated_content, final_content, versions_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&body.platform)
    .bind(&title)
    .bind(&params)
    .bind(&generated)
    .bind(&final_content)
    .bind(&versions)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let _ = inserted;
    Ok((
        StatusCode::CREATED,
        Json(creation_public(
            &load_creation(&state, &user.user_id, &id).await?,
        )),
    ))
}

async fn load_creation(state: &AppState, user_id: &str, id: &str) -> Result<CreationRow, AppError> {
    sqlx::query_as::<_, CreationRow>(
        "SELECT id, platform, title, prompt_params, generated_content, final_content, versions_json, created_at, updated_at
         FROM creations WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_creation_rows(state: &AppState, user_id: &str) -> Result<Vec<CreationRow>, AppError> {
    sqlx::query_as::<_, CreationRow>(
        "SELECT id, platform, title, prompt_params, generated_content, final_content, versions_json, created_at, updated_at
         FROM creations WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_creations(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(list_creation_rows(state, user_id)
        .await?
        .iter()
        .map(creation_public)
        .collect())
}

async fn list_creations(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_creations(&state, &user.user_id).await?
    })))
}

async fn get_creation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(creation_public(
        &load_creation(&state, &user.user_id, &id).await?,
    )))
}

async fn patch_creation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchCreationBody>,
) -> Result<Json<Value>, AppError> {
    let mut row = load_creation(&state, &user.user_id, &id).await?;
    let now = now_rfc3339();
    let mut versions = parse_versions(&row.versions_json);
    if let Some(title) = body.title {
        let trimmed = title.trim();
        row.title = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        };
    }
    if let Some(params) = body.prompt_params {
        row.prompt_params = params.to_string();
    }
    if let Some(generated) = body.generated_content {
        let text = require_text(Some(&generated), "generated_content")?;
        if text != row.generated_content {
            row.generated_content = text.clone();
            versions.push(snapshot("generate", &text, &now));
        }
    }
    if let Some(final_content) = body.final_content {
        let text = require_text(Some(&final_content), "final_content")?;
        if text != row.final_content {
            row.final_content = text.clone();
            versions.push(snapshot("edit", &text, &now));
        }
    }
    row.versions_json = Value::Array(versions).to_string();
    sqlx::query(
        "UPDATE creations
         SET title = ?, prompt_params = ?, generated_content = ?, final_content = ?, versions_json = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&row.title)
    .bind(&row.prompt_params)
    .bind(&row.generated_content)
    .bind(&row.final_content)
    .bind(&row.versions_json)
    .bind(&now)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(creation_public(
        &load_creation(&state, &user.user_id, &id).await?,
    )))
}

async fn create_snippet(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateSnippetBody>,
) -> Result<(StatusCode, Json<SnippetPublic>), AppError> {
    let content = require_text(Some(&body.content), "content")?;
    let kind = body.kind.unwrap_or_else(|| "金句".into());
    validate_snippet_kind(&kind)?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let tags = serde_json::to_string(&body.tags).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO snippets
            (id, user_id, content, kind, tags_json, usage_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&content)
    .bind(&kind)
    .bind(&tags)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(load_snippet(&state, &user.user_id, &id).await?.public()),
    ))
}

async fn load_snippet(state: &AppState, user_id: &str, id: &str) -> Result<SnippetRow, AppError> {
    sqlx::query_as::<_, SnippetRow>(
        "SELECT id, content, kind, tags_json, usage_count, created_at, updated_at
         FROM snippets WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_snippet_rows(state: &AppState, user_id: &str) -> Result<Vec<SnippetRow>, AppError> {
    sqlx::query_as::<_, SnippetRow>(
        "SELECT id, content, kind, tags_json, usage_count, created_at, updated_at
         FROM snippets WHERE user_id = ? ORDER BY usage_count DESC, updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_snippets(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(list_snippet_rows(state, user_id)
        .await?
        .into_iter()
        .map(|row| serde_json::to_value(row.public()).unwrap_or(json!({})))
        .collect())
}

async fn list_snippets(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_snippets(&state, &user.user_id).await?
    })))
}

async fn use_snippet(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<SnippetPublic>, AppError> {
    let row = load_snippet(&state, &user.user_id, &id).await?;
    let now = now_rfc3339();
    sqlx::query(
        "UPDATE snippets SET usage_count = usage_count + 1, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&now)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let _ = row;
    Ok(Json(
        load_snippet(&state, &user.user_id, &id).await?.public(),
    ))
}

async fn list_templates(
    user: AuthUser,
    Query(query): Query<PlatformQuery>,
) -> Result<Json<Value>, AppError> {
    let _ = user;
    if let Some(platform) = query.platform.as_deref() {
        validate_platform(platform)?;
    }
    let items: Vec<Value> = templates()
        .into_iter()
        .filter(|item| {
            query
                .platform
                .as_deref()
                .is_none_or(|platform| item["platform"] == platform)
        })
        .collect();
    Ok(Json(json!({ "items": items })))
}

async fn list_inspiration(user: AuthUser) -> Result<Json<Value>, AppError> {
    let _ = user;
    Ok(Json(json!({ "items": inspiration() })))
}

async fn generate(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<GenerateBody>,
) -> Result<Json<Value>, AppError> {
    validate_platform(&body.platform)?;
    let topic = require_text(Some(&body.topic), "topic")?;
    let tone = body.tone.unwrap_or_else(|| "更专业".into());
    validate_tone(&tone)?;
    let length = body.length.unwrap_or_else(|| "中".into());
    validate_length(&length)?;
    let keywords: Vec<String> = body
        .keywords
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect();
    let fallback = deterministic_generate(&body.platform, &topic, &keywords, &tone, &length);
    let prompt = format!(
        "generate;platform={};topic={};tone={};length={};template={};keywords={}",
        body.platform,
        topic,
        tone,
        length,
        body.template_id.unwrap_or_default(),
        keywords.join(",")
    );
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "text": text,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn titles(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<TitlesBody>,
) -> Result<Json<Value>, AppError> {
    let topic = require_text(Some(&body.topic), "topic")?;
    if let Some(platform) = body.platform.as_deref() {
        validate_platform(platform)?;
    }
    let mock = deterministic_titles(&topic);
    let fallback = mock.join("\n");
    let prompt = format!(
        "titles;topic={};platform={}",
        topic,
        body.platform.unwrap_or_default()
    );
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    let titles = if source == "gateway" {
        pad_titles(text.trim().to_string(), &topic)
    } else {
        mock
    };
    Ok(Json(json!({
        "titles": titles,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn polish(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PolishBody>,
) -> Result<Json<Value>, AppError> {
    let text = require_text(Some(&body.text), "text")?;
    validate_tone(&body.tone)?;
    let fallback = deterministic_polish(&text, &body.tone);
    let prompt = format!("polish;tone={};text={text}", body.tone);
    let (out, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "text": out,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn outline(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<OutlineBody>,
) -> Result<Json<Value>, AppError> {
    let topic = require_text(Some(&body.topic), "topic")?;
    let mock = deterministic_outline(&topic);
    let fallback = mock["title"].as_str().unwrap_or(&topic).to_string();
    let prompt = format!("outline;topic={topic}");
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    let mut payload = mock;
    if source == "gateway" {
        payload["title"] = json!(text.trim());
        let slides = payload["slides"].as_array().cloned().unwrap_or_default();
        payload["markdown"] = json!(outline_markdown(text.trim(), &slides));
    }
    Ok(Json(json!({
        "title": payload["title"],
        "slides": payload["slides"],
        "markdown": payload["markdown"],
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}
