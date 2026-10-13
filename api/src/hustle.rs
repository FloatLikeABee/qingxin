use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
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

pub const DISCLAIMER: &str = "以上为示意文字，不构成求职、面试或副业咨询。";

const STATUSES: &[&str] = &["投递", "面试", "Offer"];
const KINDS: &[&str] = &["线上", "线下", "技能型"];
const ROLES: &[&str] = &["前端", "后端", "产品", "运营"];
const DIFFICULTIES: &[&str] = &["基础", "进阶", "困难"];

#[derive(Clone, FromRow)]
struct ApplicationRow {
    id: String,
    company: String,
    position: String,
    status: String,
    interview_date: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, FromRow)]
struct ResumeRow {
    id: String,
    version: i64,
    title: Option<String>,
    content_json: String,
    pdf_url: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, FromRow)]
struct SideHustleRow {
    id: String,
    title: String,
    platform: String,
    estimated_income: i64,
    skills_required: String,
    kind: String,
    hours_per_week: Option<i64>,
    created_at: String,
}

#[derive(Serialize)]
pub struct ApplicationPublic {
    pub id: String,
    pub company: String,
    pub position: String,
    pub status: String,
    pub interview_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl ApplicationRow {
    fn public(self) -> ApplicationPublic {
        ApplicationPublic {
            id: self.id,
            company: self.company,
            position: self.position,
            status: self.status,
            interview_date: self.interview_date,
            notes: self.notes,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn parse_json(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or(json!({}))
}

fn parse_skills(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn resume_public(row: ResumeRow) -> Value {
    json!({
        "id": row.id,
        "version": row.version,
        "title": row.title,
        "content": parse_json(&row.content_json),
        "pdf_url": row.pdf_url,
        "created_at": row.created_at,
        "updated_at": row.updated_at
    })
}

fn hustle_public(row: SideHustleRow) -> Value {
    json!({
        "id": row.id,
        "title": row.title,
        "platform": row.platform,
        "estimated_income": row.estimated_income,
        "skills_required": parse_skills(&row.skills_required),
        "kind": row.kind,
        "hours_per_week": row.hours_per_week,
        "created_at": row.created_at
    })
}

pub fn questions() -> Vec<Value> {
    vec![
        q(
            "fe-box",
            "前端",
            "基础",
            "解释盒模型，以及 box-sizing 会怎样改变它。",
        ),
        q(
            "fe-virtual",
            "前端",
            "进阶",
            "虚拟列表要解决什么问题？你会怎么测量行高？",
        ),
        q(
            "fe-perf",
            "前端",
            "困难",
            "一次卡顿排查：你会从哪些指标入手？",
        ),
        q(
            "be-index",
            "后端",
            "基础",
            "什么时候该给一列加索引？什么时候不该加？",
        ),
        q(
            "be-tx",
            "后端",
            "进阶",
            "讲一次你处理过的事务隔离或锁等待。",
        ),
        q(
            "be-scale",
            "后端",
            "困难",
            "读多写少的接口，你会怎么做缓存与失效？",
        ),
        q(
            "pm-prio",
            "产品",
            "基础",
            "需求很多时，你用什么原则排优先级？",
        ),
        q(
            "pm-metric",
            "产品",
            "进阶",
            "如何证明一个改动值得做？你看哪些指标？",
        ),
        q(
            "ops-sop",
            "运营",
            "基础",
            "你怎样写一份别人能接着做的活动 SOP？",
        ),
        q(
            "ops-growth",
            "运营",
            "进阶",
            "拉新遇到瓶颈时，你先验证哪三个假设？",
        ),
    ]
}

fn q(id: &str, role: &str, difficulty: &str, prompt: &str) -> Value {
    json!({
        "id": id,
        "role": role,
        "difficulty": difficulty,
        "prompt": prompt
    })
}

pub fn deterministic_optimize(name: &str, title: &str) -> String {
    format!("已整理「{name}」的简历要点：突出{title}经历，把技能写成可验证成果。此为示意改写。")
}

pub fn deterministic_mock_question(question: &str) -> String {
    format!("针对「{question}」：请先说结论，再补一个你做过的例子。此为示意追问。")
}

pub fn deterministic_suggestions(skills: &[String], hours: i64) -> Vec<Value> {
    let mut ordered = skills.to_vec();
    ordered.sort();
    let hours = hours.max(1);
    let focus = ordered
        .first()
        .cloned()
        .unwrap_or_else(|| "综合技能".into());
    let joined = if ordered.is_empty() {
        "现有技能".into()
    } else {
        ordered.join("、")
    };
    let skill_card = if ordered.iter().any(|item| item.contains("设计")) {
        "模板与视觉小单"
    } else {
        "技能分享课"
    };
    let third = if hours >= 8 {
        json!({
            "title": "周末本地服务",
            "platform": "本地",
            "estimated_income": 150 * hours,
            "skills_required": ordered,
            "kind": "线下",
            "reason": "时间较充裕时可以试一次线下。"
        })
    } else {
        json!({
            "title": "碎片时间问答",
            "platform": "线上社区",
            "estimated_income": 80 * hours,
            "skills_required": ordered,
            "kind": "线上",
            "reason": "时间不多时用问答换示意收入。"
        })
    };
    vec![
        json!({
            "title": format!("{focus}方向的线上接单"),
            "platform": "线上接单",
            "estimated_income": 200 * hours,
            "skills_required": ordered,
            "kind": "线上",
            "reason": format!("每周约{hours}小时，适合先从线上开始。")
        }),
        json!({
            "title": skill_card,
            "platform": "技能型平台",
            "estimated_income": 350 * hours,
            "skills_required": ordered,
            "kind": "技能型",
            "reason": format!("结合{joined}做可复用交付。")
        }),
        third,
    ]
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/v1/hustle/applications",
            get(list_applications).post(create_application),
        )
        .route("/v1/hustle/applications/{id}", patch(patch_application))
        .route("/v1/hustle/funnel", get(funnel))
        .route("/v1/hustle/resumes", get(list_resumes).post(create_resume))
        .route("/v1/hustle/resumes/{id}", patch(patch_resume))
        .route("/v1/hustle/resumes/{id}/optimize", post(optimize_resume))
        .route(
            "/v1/hustle/side-hustles",
            get(list_side_hustles).post(create_side_hustle),
        )
        .route(
            "/v1/hustle/side-hustles/suggest",
            post(suggest_side_hustles),
        )
        .route("/v1/hustle/questions", get(list_questions))
        .route("/v1/hustle/interviews/mock", post(mock_interview))
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

fn validate_status(status: &str) -> Result<(), AppError> {
    if STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!(
            "unknown status: {status}"
        )))
    }
}

fn validate_kind(kind: &str) -> Result<(), AppError> {
    if KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::InvalidRequest(format!("unknown kind: {kind}")))
    }
}

fn content_name(content: &Value) -> Result<String, AppError> {
    require_text(content.get("name").and_then(Value::as_str), "name")
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
        model: Some("qingxin-hustle".into()),
    };
    match state.ai.complete(user_id, req).await {
        Ok(done) if !done.content.trim().is_empty() => Ok((done.content, "gateway")),
        Ok(_) | Err(AiError::Unconfigured) => Ok((fallback, "mock")),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}

#[derive(Deserialize)]
struct CreateApplicationBody {
    id: Option<String>,
    company: String,
    position: String,
    status: Option<String>,
    interview_date: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct PatchApplicationBody {
    status: Option<String>,
    interview_date: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct CreateResumeBody {
    id: Option<String>,
    title: Option<String>,
    content: Value,
}

#[derive(Deserialize)]
struct PatchResumeBody {
    title: Option<String>,
    content: Option<Value>,
}

#[derive(Deserialize)]
struct CreateSideHustleBody {
    id: Option<String>,
    title: String,
    platform: String,
    estimated_income: i64,
    #[serde(default)]
    skills_required: Vec<String>,
    kind: String,
    hours_per_week: Option<i64>,
}

#[derive(Deserialize)]
struct KindQuery {
    kind: Option<String>,
}

#[derive(Deserialize)]
struct QuestionQuery {
    role: Option<String>,
    difficulty: Option<String>,
}

#[derive(Deserialize)]
struct MockInterviewBody {
    question_id: Option<String>,
    question: Option<String>,
}

#[derive(Deserialize)]
struct SuggestBody {
    #[serde(default)]
    skills: Vec<String>,
    #[serde(default)]
    hours_per_week: i64,
}

async fn create_application(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateApplicationBody>,
) -> Result<(StatusCode, Json<ApplicationPublic>), AppError> {
    let company = require_text(Some(&body.company), "company")?;
    let position = require_text(Some(&body.position), "position")?;
    let status = body.status.unwrap_or_else(|| "投递".into());
    validate_status(&status)?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let interview_date = body
        .interview_date
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let inserted = sqlx::query(
        "INSERT INTO applications
            (id, user_id, company, position, status, interview_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&company)
    .bind(&position)
    .bind(&status)
    .bind(&interview_date)
    .bind(&body.notes)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        return Ok((
            StatusCode::CREATED,
            Json(load_application(&state, &user.user_id, &id).await?.public()),
        ));
    }
    Ok((
        StatusCode::CREATED,
        Json(load_application(&state, &user.user_id, &id).await?.public()),
    ))
}

async fn load_application(
    state: &AppState,
    user_id: &str,
    id: &str,
) -> Result<ApplicationRow, AppError> {
    sqlx::query_as::<_, ApplicationRow>(
        "SELECT id, company, position, status, interview_date, notes, created_at, updated_at
         FROM applications WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_application_rows(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<ApplicationRow>, AppError> {
    sqlx::query_as::<_, ApplicationRow>(
        "SELECT id, company, position, status, interview_date, notes, created_at, updated_at
         FROM applications WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_applications(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<ApplicationPublic>, AppError> {
    Ok(list_application_rows(state, user_id)
        .await?
        .into_iter()
        .map(ApplicationRow::public)
        .collect())
}

async fn list_applications(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_applications(&state, &user.user_id).await?
    })))
}

async fn patch_application(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchApplicationBody>,
) -> Result<Json<ApplicationPublic>, AppError> {
    let mut row = load_application(&state, &user.user_id, &id).await?;
    if let Some(status) = body.status.as_deref() {
        validate_status(status)?;
        row.status = status.to_string();
    }
    if let Some(date) = body.interview_date {
        let trimmed = date.trim();
        row.interview_date = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        };
    }
    if let Some(notes) = body.notes {
        row.notes = Some(notes);
    }
    let now = now_rfc3339();
    sqlx::query(
        "UPDATE applications
         SET status = ?, interview_date = ?, notes = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&row.status)
    .bind(&row.interview_date)
    .bind(&row.notes)
    .bind(&now)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(
        load_application(&state, &user.user_id, &id).await?.public(),
    ))
}

async fn funnel(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let rows = list_application_rows(&state, &user.user_id).await?;
    let stages: Vec<Value> = STATUSES
        .iter()
        .map(|status| {
            let count = rows.iter().filter(|row| row.status == *status).count();
            json!({ "status": status, "count": count })
        })
        .collect();
    Ok(Json(json!({ "stages": stages })))
}

async fn next_resume_version(state: &AppState, user_id: &str) -> Result<i64, AppError> {
    let max: Option<i64> = sqlx::query_scalar("SELECT MAX(version) FROM resumes WHERE user_id = ?")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(max.unwrap_or(0) + 1)
}

async fn create_resume(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateResumeBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let _name = content_name(&body.content)?;
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let content = body.content.to_string();
    let version = next_resume_version(&state, &user.user_id).await?;
    let inserted = sqlx::query(
        "INSERT INTO resumes
            (id, user_id, version, title, content_json, pdf_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(version)
    .bind(&body.title)
    .bind(&content)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        return Ok((
            StatusCode::CREATED,
            Json(resume_public(
                load_resume(&state, &user.user_id, &id).await?,
            )),
        ));
    }
    Ok((
        StatusCode::CREATED,
        Json(resume_public(
            load_resume(&state, &user.user_id, &id).await?,
        )),
    ))
}

async fn load_resume(state: &AppState, user_id: &str, id: &str) -> Result<ResumeRow, AppError> {
    sqlx::query_as::<_, ResumeRow>(
        "SELECT id, version, title, content_json, pdf_url, created_at, updated_at
         FROM resumes WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_resume_rows(state: &AppState, user_id: &str) -> Result<Vec<ResumeRow>, AppError> {
    sqlx::query_as::<_, ResumeRow>(
        "SELECT id, version, title, content_json, pdf_url, created_at, updated_at
         FROM resumes WHERE user_id = ? ORDER BY version DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_resumes(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(list_resume_rows(state, user_id)
        .await?
        .into_iter()
        .map(resume_public)
        .collect())
}

async fn list_resumes(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(
        json!({ "items": export_resumes(&state, &user.user_id).await? }),
    ))
}

async fn patch_resume(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchResumeBody>,
) -> Result<Json<Value>, AppError> {
    let mut row = load_resume(&state, &user.user_id, &id).await?;
    if let Some(content) = body.content {
        content_name(&content)?;
        row.content_json = content.to_string();
    }
    if let Some(title) = body.title {
        row.title = Some(title);
    }
    let now = now_rfc3339();
    sqlx::query(
        "UPDATE resumes SET title = ?, content_json = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&row.title)
    .bind(&row.content_json)
    .bind(&now)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(resume_public(
        load_resume(&state, &user.user_id, &id).await?,
    )))
}

async fn optimize_resume(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = load_resume(&state, &user.user_id, &id).await?;
    let content = parse_json(&row.content_json);
    let name = content
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("求职者");
    let title = content
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("相关岗位");
    let fallback = deterministic_optimize(name, title);
    let prompt = format!("optimize resume;name={name};title={title}");
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "text": text,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn create_side_hustle(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateSideHustleBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let title = require_text(Some(&body.title), "title")?;
    let platform = require_text(Some(&body.platform), "platform")?;
    validate_kind(&body.kind)?;
    if body.estimated_income < 0 {
        return Err(AppError::InvalidRequest(
            "estimated_income must be >= 0".into(),
        ));
    }
    if let Some(hours) = body.hours_per_week {
        if hours < 0 {
            return Err(AppError::InvalidRequest(
                "hours_per_week must be >= 0".into(),
            ));
        }
    }
    let id = client_or_new_id(body.id.as_deref())?;
    let now = now_rfc3339();
    let skills = serde_json::to_string(&body.skills_required).unwrap_or_else(|_| "[]".into());
    let inserted = sqlx::query(
        "INSERT INTO side_hustles
            (id, user_id, title, platform, estimated_income, skills_required, kind, hours_per_week, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&title)
    .bind(&platform)
    .bind(body.estimated_income)
    .bind(&skills)
    .bind(&body.kind)
    .bind(body.hours_per_week)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if inserted.rows_affected() == 0 {
        return Ok((
            StatusCode::CREATED,
            Json(hustle_public(
                load_side_hustle(&state, &user.user_id, &id).await?,
            )),
        ));
    }
    Ok((
        StatusCode::CREATED,
        Json(hustle_public(
            load_side_hustle(&state, &user.user_id, &id).await?,
        )),
    ))
}

async fn load_side_hustle(
    state: &AppState,
    user_id: &str,
    id: &str,
) -> Result<SideHustleRow, AppError> {
    sqlx::query_as::<_, SideHustleRow>(
        "SELECT id, title, platform, estimated_income, skills_required, kind, hours_per_week, created_at
         FROM side_hustles WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn list_side_hustle_rows(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<SideHustleRow>, AppError> {
    sqlx::query_as::<_, SideHustleRow>(
        "SELECT id, title, platform, estimated_income, skills_required, kind, hours_per_week, created_at
         FROM side_hustles WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_side_hustles(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(list_side_hustle_rows(state, user_id)
        .await?
        .into_iter()
        .map(hustle_public)
        .collect())
}

async fn list_side_hustles(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<KindQuery>,
) -> Result<Json<Value>, AppError> {
    if let Some(kind) = query.kind.as_deref() {
        validate_kind(kind)?;
    }
    let mut items = export_side_hustles(&state, &user.user_id).await?;
    if let Some(kind) = query.kind.as_deref() {
        items.retain(|item| item["kind"] == kind);
    }
    Ok(Json(json!({ "items": items })))
}

async fn list_questions(
    user: AuthUser,
    Query(query): Query<QuestionQuery>,
) -> Result<Json<Value>, AppError> {
    let _ = user;
    if let Some(role) = query.role.as_deref() {
        if !ROLES.contains(&role) {
            return Err(AppError::InvalidRequest(format!("unknown role: {role}")));
        }
    }
    if let Some(difficulty) = query.difficulty.as_deref() {
        if !DIFFICULTIES.contains(&difficulty) {
            return Err(AppError::InvalidRequest(format!(
                "unknown difficulty: {difficulty}"
            )));
        }
    }
    let items: Vec<Value> = questions()
        .into_iter()
        .filter(|item| {
            query
                .role
                .as_deref()
                .is_none_or(|role| item["role"] == role)
                && query
                    .difficulty
                    .as_deref()
                    .is_none_or(|diff| item["difficulty"] == diff)
        })
        .collect();
    Ok(Json(json!({ "items": items })))
}

async fn mock_interview(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<MockInterviewBody>,
) -> Result<Json<Value>, AppError> {
    let question = if let Some(id) = body.question_id.as_deref() {
        questions()
            .into_iter()
            .find(|item| item["id"] == id)
            .and_then(|item| item["prompt"].as_str().map(str::to_string))
            .ok_or(AppError::NotFound)?
    } else {
        require_text(body.question.as_deref(), "question")?
    };
    let fallback = deterministic_mock_question(&question);
    let prompt = format!("mock interviewer;question={question}");
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    Ok(Json(json!({
        "question": question,
        "text": text,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}

async fn suggest_side_hustles(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<SuggestBody>,
) -> Result<Json<Value>, AppError> {
    let fallback_items = deterministic_suggestions(&body.skills, body.hours_per_week);
    let fallback = serde_json::to_string(&fallback_items).unwrap_or_else(|_| "[]".into());
    let mut ordered = body.skills.clone();
    ordered.sort();
    let prompt = format!(
        "suggest side hustles;hours={};skills={}",
        body.hours_per_week,
        ordered.join(",")
    );
    let (text, source) = complete_or_mock(&state, &user.user_id, prompt, fallback).await?;
    let items = if source == "gateway" {
        let mut items = fallback_items;
        if let Some(first) = items.first_mut() {
            first["title"] = json!(text);
            first["reason"] = json!(text);
        }
        items
    } else {
        serde_json::from_str(&text).unwrap_or(fallback_items)
    };
    Ok(Json(json!({
        "items": items,
        "disclaimer": DISCLAIMER,
        "source": source
    })))
}
