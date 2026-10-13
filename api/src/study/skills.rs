use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;
use std::collections::HashMap;

use super::{CreateSkillBody, FromTemplateBody, PatchSkillBody, DISCLAIMER};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow, Clone)]
struct SkillRow {
    id: String,
    parent_id: Option<String>,
    title: String,
    unlocked: i64,
    sort_order: i64,
    created_at: String,
}

impl SkillRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "parent_id": self.parent_id,
            "title": self.title,
            "unlocked": self.unlocked != 0,
            "sort_order": self.sort_order,
            "created_at": self.created_at,
        })
    }
}

struct TemplateNode {
    key: &'static str,
    title: &'static str,
    parent: Option<&'static str>,
    unlocked: bool,
}

struct Template {
    id: &'static str,
    title: &'static str,
    nodes: &'static [TemplateNode],
}

const TEMPLATES: &[Template] = &[
    Template {
        id: "english-vocab",
        title: "英语词汇",
        nodes: &[
            TemplateNode {
                key: "roots",
                title: "词根",
                parent: None,
                unlocked: true,
            },
            TemplateNode {
                key: "words",
                title: "单词",
                parent: Some("roots"),
                unlocked: false,
            },
            TemplateNode {
                key: "sentences",
                title: "例句",
                parent: Some("words"),
                unlocked: false,
            },
        ],
    },
    Template {
        id: "piano",
        title: "钢琴",
        nodes: &[
            TemplateNode {
                key: "read",
                title: "识谱",
                parent: None,
                unlocked: true,
            },
            TemplateNode {
                key: "scale",
                title: "音阶",
                parent: Some("read"),
                unlocked: false,
            },
            TemplateNode {
                key: "piece",
                title: "曲目",
                parent: Some("scale"),
                unlocked: false,
            },
        ],
    },
];

const SELECT: &str =
    "SELECT id, parent_id, title, unlocked, sort_order, created_at FROM study_skill_nodes";

fn require_title(raw: &str) -> Result<String, AppError> {
    let title = raw.trim();
    if title.is_empty() || title.chars().count() > 64 {
        return Err(AppError::InvalidRequest("title is invalid".into()));
    }
    Ok(title.to_string())
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<SkillRow, AppError> {
    sqlx::query_as::<_, SkillRow>(&format!("{SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

async fn load_user(state: &AppState, user_id: &str) -> Result<Vec<SkillRow>, AppError> {
    sqlx::query_as::<_, SkillRow>(&format!(
        "{SELECT} WHERE user_id = ? ORDER BY sort_order, created_at"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(load_user(state, user_id)
        .await?
        .iter()
        .map(SkillRow::public)
        .collect())
}

async fn assert_parent(
    state: &AppState,
    user_id: &str,
    parent_id: Option<&str>,
    self_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    let Some(parent_id) = parent_id.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if self_id == Some(parent_id) {
        return Err(AppError::InvalidRequest("parent_id cannot be self".into()));
    }
    let parent = load_one(state, user_id, parent_id).await?;
    let mut cursor = parent.parent_id.clone();
    let mut hops = 0;
    while let Some(id) = cursor {
        hops += 1;
        if hops > 32 || self_id == Some(id.as_str()) {
            return Err(AppError::InvalidRequest("skill tree cycle".into()));
        }
        cursor = load_one(state, user_id, &id).await?.parent_id;
    }
    Ok(Some(parent.id))
}

pub async fn templates(_user: AuthUser) -> Json<Value> {
    Json(json!({
        "items": TEMPLATES.iter().map(|item| json!({
            "id": item.id,
            "title": item.title,
            "nodes": item.nodes.iter().map(|node| json!({
                "key": node.key,
                "title": node.title,
                "parent": node.parent,
                "unlocked": node.unlocked,
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "disclaimer": DISCLAIMER,
    }))
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
    Json(body): Json<CreateSkillBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let title = require_title(&body.title)?;
    let parent_id = assert_parent(&state, &user.user_id, body.parent_id.as_deref(), None).await?;
    let id = new_id();
    let now = now_rfc3339();
    let unlocked = body.unlocked.unwrap_or(true);
    let sort_order = body.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO study_skill_nodes
            (id, user_id, parent_id, title, unlocked, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&parent_id)
    .bind(&title)
    .bind(i64::from(unlocked))
    .bind(sort_order)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(load_one(&state, &user.user_id, &id).await?.public()),
    ))
}

pub async fn from_template(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<FromTemplateBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let template = TEMPLATES
        .iter()
        .find(|item| item.id == body.template_id.trim())
        .ok_or(AppError::NotFound)?;
    let mut ids = HashMap::new();
    let now = now_rfc3339();
    let mut created = Vec::new();
    for (index, node) in template.nodes.iter().enumerate() {
        let id = new_id();
        ids.insert(node.key, id.clone());
        let parent_id = node.parent.and_then(|key| ids.get(key).cloned());
        sqlx::query(
            "INSERT INTO study_skill_nodes
                (id, user_id, parent_id, title, unlocked, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&user.user_id)
        .bind(&parent_id)
        .bind(node.title)
        .bind(i64::from(node.unlocked))
        .bind(index as i64)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        created.push(load_one(&state, &user.user_id, &id).await?);
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "items": created.iter().map(SkillRow::public).collect::<Vec<_>>(),
            "disclaimer": DISCLAIMER,
        })),
    ))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchSkillBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let title = match body.title.as_deref() {
        Some(raw) => require_title(raw)?,
        None => current.title.clone(),
    };
    let parent_id = if body.parent_id.is_some() {
        assert_parent(&state, &user.user_id, body.parent_id.as_deref(), Some(&id)).await?
    } else {
        current.parent_id.clone()
    };
    let unlocked = body.unlocked.unwrap_or(current.unlocked != 0);
    let sort_order = body.sort_order.unwrap_or(current.sort_order);
    sqlx::query(
        "UPDATE study_skill_nodes
         SET title = ?, parent_id = ?, unlocked = ?, sort_order = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&title)
    .bind(&parent_id)
    .bind(i64::from(unlocked))
    .bind(sort_order)
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(load_one(&state, &user.user_id, &id).await?.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM study_skill_nodes WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
