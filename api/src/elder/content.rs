use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{authorize_elder_access, ElderPerm};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, normalize_phone, now_rfc3339};

#[derive(FromRow, Serialize)]
struct TutorialRow {
    id: String,
    elder_user_id: Option<String>,
    created_by_user_id: Option<String>,
    title: String,
    steps_json: String,
    created_at: String,
}

fn tutorial_value(row: TutorialRow) -> Value {
    json!({
        "id": row.id,
        "elder_user_id": row.elder_user_id,
        "created_by_user_id": row.created_by_user_id,
        "title": row.title,
        "steps": serde_json::from_str::<Value>(&row.steps_json).unwrap_or(json!([])),
        "created_at": row.created_at,
    })
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

pub async fn list_system_tutorials(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query_as::<_, TutorialRow>(
        "SELECT id, elder_user_id, created_by_user_id, title, steps_json, created_at
         FROM elder_tutorials WHERE elder_user_id IS NULL ORDER BY title ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.into_iter().map(tutorial_value).collect::<Vec<_>>()
    })))
}

pub async fn list_family_tutorials(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let rows = sqlx::query_as::<_, TutorialRow>(
        "SELECT id, elder_user_id, created_by_user_id, title, steps_json, created_at
         FROM elder_tutorials WHERE elder_user_id = ? ORDER BY created_at DESC",
    )
    .bind(&elder_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": rows.into_iter().map(tutorial_value).collect::<Vec<_>>()
    })))
}

#[derive(Deserialize)]
pub struct TutorialBody {
    pub title: String,
    pub steps: Value,
}

pub async fn create_tutorial(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
    Json(body): Json<TutorialBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let title = body.title.trim();
    if title.is_empty() || !body.steps.is_array() {
        return Err(AppError::InvalidRequest(
            "title and steps array are required".into(),
        ));
    }
    let _ = state.moderator.check(title).await;
    let id = new_id();
    let now = now_rfc3339();
    let steps = body.steps.to_string();
    sqlx::query(
        "INSERT INTO elder_tutorials
            (id, elder_user_id, created_by_user_id, title, steps_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&elder_id)
    .bind(&user.user_id)
    .bind(title)
    .bind(&steps)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": id,
            "elder_user_id": elder_id,
            "created_by_user_id": user.user_id,
            "title": title,
            "steps": body.steps,
            "created_at": now,
        })),
    ))
}

#[derive(Deserialize)]
pub struct PatchTutorialBody {
    pub title: Option<String>,
    pub steps: Option<Value>,
}

pub async fn patch_tutorial(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
    Json(body): Json<PatchTutorialBody>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let row = sqlx::query_as::<_, TutorialRow>(
        "SELECT id, elder_user_id, created_by_user_id, title, steps_json, created_at
         FROM elder_tutorials WHERE id = ? AND elder_user_id = ?",
    )
    .bind(&id)
    .bind(&elder_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)?;
    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&row.title);
    let steps = body
        .steps
        .as_ref()
        .map(ToString::to_string)
        .unwrap_or(row.steps_json.clone());
    sqlx::query(
        "UPDATE elder_tutorials SET title = ?, steps_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(title)
    .bind(&steps)
    .bind(now_rfc3339())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "id": id,
        "elder_user_id": elder_id,
        "created_by_user_id": row.created_by_user_id,
        "title": title,
        "steps": serde_json::from_str::<Value>(&steps).unwrap_or(json!([])),
        "created_at": row.created_at,
    })))
}

pub async fn delete_tutorial(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let result = sqlx::query("DELETE FROM elder_tutorials WHERE id = ? AND elder_user_id = ?")
        .bind(id)
        .bind(elder_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(FromRow, Serialize)]
struct FraudRow {
    id: String,
    title: String,
    body: String,
    source_name: String,
    source_url: String,
    updated_at: String,
}

pub async fn list_fraud_scripts(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query_as::<_, FraudRow>(
        "SELECT id, title, body, source_name, source_url, updated_at FROM fraud_scripts ORDER BY title ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let q = query
        .q
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());
    let items: Vec<FraudRow> = match q {
        Some(needle) => rows
            .into_iter()
            .filter(|row| {
                row.title.to_lowercase().contains(&needle)
                    || row.body.to_lowercase().contains(&needle)
            })
            .collect(),
        None => rows,
    };
    Ok(Json(json!({ "items": items })))
}

#[derive(Deserialize)]
pub struct PatchFraudBody {
    pub title: Option<String>,
    pub body: Option<String>,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
}

pub async fn patch_fraud_script(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchFraudBody>,
) -> Result<Json<Value>, AppError> {
    let editor = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM elder_content_editors WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if editor == 0 {
        return Err(AppError::Forbidden);
    }
    let current = sqlx::query_as::<_, FraudRow>(
        "SELECT id, title, body, source_name, source_url, updated_at FROM fraud_scripts WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)?;
    let title = body.title.as_deref().unwrap_or(&current.title);
    let text = body.body.as_deref().unwrap_or(&current.body);
    let source_name = body.source_name.as_deref().unwrap_or(&current.source_name);
    let source_url = body.source_url.as_deref().unwrap_or(&current.source_url);
    sqlx::query(
        "UPDATE fraud_scripts
         SET title = ?, body = ?, source_name = ?, source_url = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(title)
    .bind(text)
    .bind(source_name)
    .bind(source_url)
    .bind(now_rfc3339())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, FraudRow>(
        "SELECT id, title, body, source_name, source_url, updated_at FROM fraud_scripts WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!(row)))
}

#[derive(Deserialize)]
pub struct FlagBody {
    pub phone: String,
}

pub async fn flag_number(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<FlagBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let phone = normalize_phone(&body.phone)?;
    let lookup = state.crypto.lookup_hash(&phone);
    let id = new_id();
    sqlx::query(
        "INSERT INTO elder_number_flags (id, user_id, phone_lookup, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, phone_lookup) DO NOTHING",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&lookup)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(json!({ "flagged": true }))))
}

#[derive(Deserialize)]
pub struct PhoneQuery {
    pub phone: String,
}

pub async fn check_number(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<PhoneQuery>,
) -> Result<Json<Value>, AppError> {
    let phone = normalize_phone(&query.phone)?;
    let lookup = state.crypto.lookup_hash(&phone);
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT user_id) FROM elder_number_flags WHERE phone_lookup = ?",
    )
    .bind(lookup)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "flagged": count > 0,
        "count": count,
    })))
}
