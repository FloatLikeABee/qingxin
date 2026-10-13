use axum::extract::{Path, State};
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

#[derive(FromRow)]
struct ContactRow {
    id: String,
    elder_user_id: String,
    created_by_user_id: String,
    name: String,
    relation: String,
    phone_encrypted: Vec<u8>,
    created_at: String,
}

#[derive(Serialize)]
pub struct ContactPublic {
    pub id: String,
    pub elder_user_id: String,
    pub created_by_user_id: String,
    pub name: String,
    pub relation: String,
    pub phone: String,
    pub is_emergency: bool,
    pub created_at: String,
}

impl ContactRow {
    fn public(&self, phone: String) -> ContactPublic {
        ContactPublic {
            id: self.id.clone(),
            elder_user_id: self.elder_user_id.clone(),
            created_by_user_id: self.created_by_user_id.clone(),
            name: self.name.clone(),
            relation: self.relation.clone(),
            phone,
            is_emergency: false,
            created_at: self.created_at.clone(),
        }
    }
}

fn emergency(elder_id: &str, id: &str, name: &str, phone: &str) -> ContactPublic {
    ContactPublic {
        id: id.to_string(),
        elder_user_id: elder_id.to_string(),
        created_by_user_id: elder_id.to_string(),
        name: name.to_string(),
        relation: "紧急".into(),
        phone: phone.to_string(),
        is_emergency: true,
        created_at: "2026-10-13T00:00:00Z".into(),
    }
}

pub async fn contact_items(
    state: &AppState,
    elder_id: &str,
) -> Result<Vec<ContactPublic>, AppError> {
    let rows = sqlx::query_as::<_, ContactRow>(
        "SELECT id, elder_user_id, created_by_user_id, name, relation, phone_encrypted, created_at
         FROM elder_contacts WHERE elder_user_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(elder_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut items = vec![
        emergency(elder_id, "emergency-120", "急救中心", "120"),
        emergency(elder_id, "emergency-110", "报警", "110"),
    ];
    for row in rows {
        let phone = state
            .crypto
            .decrypt(&row.phone_encrypted)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .unwrap_or_default();
        items.push(row.public(phone));
    }
    Ok(items)
}

#[derive(Deserialize)]
pub struct ContactBody {
    pub name: String,
    pub relation: String,
    pub phone: String,
}

pub async fn list_contacts(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let items = contact_items(&state, &elder_id).await?;
    Ok(Json(json!({ "items": items })))
}

pub async fn create_contact(
    State(state): State<AppState>,
    user: AuthUser,
    Path(elder_id): Path<String>,
    Json(body): Json<ContactBody>,
) -> Result<(StatusCode, Json<ContactPublic>), AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let name = body.name.trim();
    let relation = body.relation.trim();
    if name.is_empty() || relation.is_empty() {
        return Err(AppError::InvalidRequest(
            "name and relation are required".into(),
        ));
    }
    let phone = normalize_phone(&body.phone)?;
    let encrypted = state.crypto.encrypt(phone.as_bytes())?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO elder_contacts
            (id, elder_user_id, created_by_user_id, name, relation, phone_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&elder_id)
    .bind(&user.user_id)
    .bind(name)
    .bind(relation)
    .bind(&encrypted)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(ContactPublic {
            id,
            elder_user_id: elder_id,
            created_by_user_id: user.user_id,
            name: name.to_string(),
            relation: relation.to_string(),
            phone,
            is_emergency: false,
            created_at: now,
        }),
    ))
}

#[derive(Deserialize)]
pub struct PatchContactBody {
    pub name: Option<String>,
    pub relation: Option<String>,
    pub phone: Option<String>,
}

pub async fn patch_contact(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
    Json(body): Json<PatchContactBody>,
) -> Result<Json<ContactPublic>, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let row = sqlx::query_as::<_, ContactRow>(
        "SELECT id, elder_user_id, created_by_user_id, name, relation, phone_encrypted, created_at
         FROM elder_contacts WHERE id = ? AND elder_user_id = ?",
    )
    .bind(&id)
    .bind(&elder_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)?;
    let name = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&row.name);
    let relation = body
        .relation
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&row.relation);
    let phone = if let Some(raw) = body.phone.as_deref() {
        normalize_phone(raw)?
    } else {
        state
            .crypto
            .decrypt(&row.phone_encrypted)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .unwrap_or_default()
    };
    let encrypted = state.crypto.encrypt(phone.as_bytes())?;
    sqlx::query(
        "UPDATE elder_contacts SET name = ?, relation = ?, phone_encrypted = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(name)
    .bind(relation)
    .bind(&encrypted)
    .bind(now_rfc3339())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(ContactPublic {
        id,
        elder_user_id: elder_id,
        created_by_user_id: row.created_by_user_id,
        name: name.to_string(),
        relation: relation.to_string(),
        phone,
        is_emergency: false,
        created_at: row.created_at,
    }))
}

pub async fn delete_contact(
    State(state): State<AppState>,
    user: AuthUser,
    Path((elder_id, id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    let elder_id =
        authorize_elder_access(&state, &user.user_id, &elder_id, ElderPerm::Manage).await?;
    let result = sqlx::query("DELETE FROM elder_contacts WHERE id = ? AND elder_user_id = ?")
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
