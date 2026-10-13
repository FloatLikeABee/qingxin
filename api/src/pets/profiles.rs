use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use super::{
    optional_date, optional_text, owned_pet, require_name, require_species, CreatePetBody,
    PatchPetBody, PetRow, PET_SELECT,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let items = sqlx::query_as::<_, PetRow>(&format!(
        "{PET_SELECT} WHERE user_id = ? ORDER BY sort_order, created_at"
    ))
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "items": items.iter().map(PetRow::public).collect::<Vec<_>>(),
    })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreatePetBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let name = require_name(&body.name)?;
    let species = require_species(&body.species)?;
    let breed = optional_text(body.breed.as_deref(), 80, "breed")?;
    let birthday = optional_date(body.birthday.as_deref())?;
    let avatar_url = optional_text(body.avatar_url.as_deref(), 2048, "avatar_url")?;
    let sort_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM pet_pets WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO pet_pets
            (id, user_id, name, species, breed, birthday, avatar_url, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&name)
    .bind(species)
    .bind(&breed)
    .bind(&birthday)
    .bind(&avatar_url)
    .bind(sort_order)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = owned_pet(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let row = owned_pet(&state, &user.user_id, &id).await?;
    Ok(Json(row.public()))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchPetBody>,
) -> Result<Json<Value>, AppError> {
    let current = owned_pet(&state, &user.user_id, &id).await?;
    let name = if let Some(name) = body.name.as_deref() {
        require_name(name)?
    } else {
        current.name
    };
    let species = if let Some(species) = body.species.as_deref() {
        require_species(species)?.to_string()
    } else {
        current.species
    };
    let breed = if body.breed.is_some() {
        optional_text(body.breed.as_deref(), 80, "breed")?
    } else {
        current.breed
    };
    let birthday = if body.birthday.is_some() {
        optional_date(body.birthday.as_deref())?
    } else {
        current.birthday
    };
    let avatar_url = if body.avatar_url.is_some() {
        optional_text(body.avatar_url.as_deref(), 2048, "avatar_url")?
    } else {
        current.avatar_url
    };
    sqlx::query(
        "UPDATE pet_pets
         SET name = ?, species = ?, breed = ?, birthday = ?, avatar_url = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(&name)
    .bind(&species)
    .bind(&breed)
    .bind(&birthday)
    .bind(&avatar_url)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(owned_pet(&state, &user.user_id, &id).await?.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM pet_pets WHERE id = ? AND user_id = ?")
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
