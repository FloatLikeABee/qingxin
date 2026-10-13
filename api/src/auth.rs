use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339, random_token, sha256_hex};

#[derive(Debug, Serialize, Deserialize)]
struct AccessClaims {
    sub: String,
    email: Option<String>,
    name: String,
    typ: String,
    exp: i64,
    iat: i64,
    jti: String,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub display_name: String,
    pub email: Option<String>,
}

#[derive(FromRow)]
struct RefreshRow {
    user_id: String,
    family_id: String,
    expires_at: String,
    revoked_at: Option<String>,
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AppError::Unavailable("password hash failed".into()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|_| AppError::Unavailable("password hash parse failed".into()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

pub fn issue_access_token(
    state: &AppState,
    user_id: &str,
    email: Option<&str>,
    display_name: &str,
) -> Result<(String, i64), AppError> {
    let now = Utc::now();
    let exp = now + Duration::seconds(state.config.access_ttl_secs);
    let claims = AccessClaims {
        sub: user_id.to_string(),
        email: email.map(ToOwned::to_owned),
        name: display_name.to_string(),
        typ: "access".into(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
        jti: new_id(),
    };
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &state.config.encoding_key(),
    )
    .map_err(|_| AppError::Unavailable("jwt encode failed".into()))?;
    Ok((token, state.config.access_ttl_secs))
}

fn decode_access_token(state: &AppState, token: &str) -> Result<AccessClaims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp", "sub"]);
    let data = decode::<AccessClaims>(token, &state.config.decoding_key(), &validation)
        .map_err(|_| AppError::Unauthenticated)?;
    if data.claims.typ != "access" {
        return Err(AppError::Unauthenticated);
    }
    Ok(data.claims)
}

pub async fn issue_refresh_token(
    state: &AppState,
    user_id: &str,
    family_id: Option<&str>,
) -> Result<String, AppError> {
    let token = random_token();
    let family = family_id.map(ToOwned::to_owned).unwrap_or_else(new_id);
    let expires = Utc::now() + Duration::seconds(state.config.refresh_ttl_secs);
    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(new_id())
    .bind(user_id)
    .bind(sha256_hex(token.as_bytes()))
    .bind(family)
    .bind(expires.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(token)
}

pub async fn rotate_refresh_token(
    state: &AppState,
    presented: &str,
) -> Result<(String, String), AppError> {
    if presented.is_empty() {
        return Err(AppError::InvalidRequest("refresh_token is required".into()));
    }
    let hash = sha256_hex(presented.as_bytes());
    let now = now_rfc3339();
    let row = sqlx::query_as::<_, RefreshRow>(
        "SELECT user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
    )
    .bind(&hash)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;

    let Some(row) = row else {
        return Err(AppError::Unauthenticated);
    };

    if row.revoked_at.is_some() {
        sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ? AND revoked_at IS NULL",
        )
        .bind(&now)
        .bind(&row.family_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        return Err(AppError::Unauthenticated);
    }

    if row.expires_at <= now {
        return Err(AppError::Unauthenticated);
    }

    sqlx::query("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?")
        .bind(&now)
        .bind(&hash)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;

    let next = issue_refresh_token(state, &row.user_id, Some(&row.family_id)).await?;
    Ok((row.user_id, next))
}

pub async fn revoke_refresh_token(state: &AppState, presented: &str) -> Result<(), AppError> {
    if presented.is_empty() {
        return Err(AppError::InvalidRequest("refresh_token is required".into()));
    }
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?",
    )
    .bind(now_rfc3339())
    .bind(sha256_hex(presented.as_bytes()))
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

async fn load_user(state: &AppState, user_id: &str) -> Result<AuthUser, AppError> {
    let row = sqlx::query_as::<_, (String, Option<String>, String)>(
        "SELECT id, email, display_name FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some((id, email, display_name)) = row else {
        return Err(AppError::Unauthenticated);
    };
    Ok(AuthUser {
        user_id: id,
        display_name,
        email,
    })
}

async fn auth_from_device(state: &AppState, token: &str) -> Result<AuthUser, AppError> {
    let hash = sha256_hex(token.as_bytes());
    let now = now_rfc3339();
    let row = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT user_id, expires_at, revoked_at FROM device_sessions WHERE token_hash = ?",
    )
    .bind(hash)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some((user_id, expires_at, revoked_at)) = row else {
        return Err(AppError::Unauthenticated);
    };
    if revoked_at.is_some() {
        return Err(AppError::Unauthenticated);
    }
    if expires_at.as_deref().is_some_and(|exp| exp <= now.as_str()) {
        return Err(AppError::Unauthenticated);
    }
    sqlx::query("UPDATE device_sessions SET last_used_at = ? WHERE token_hash = ?")
        .bind(&now)
        .bind(sha256_hex(token.as_bytes()))
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    load_user(state, &user_id).await
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthenticated)?;
        let (scheme, token) = header.split_once(' ').ok_or(AppError::Unauthenticated)?;
        let token = token.trim();
        if token.is_empty() {
            return Err(AppError::Unauthenticated);
        }
        if scheme.eq_ignore_ascii_case("device") {
            return auth_from_device(state, token).await;
        }
        if !scheme.eq_ignore_ascii_case("bearer") {
            return Err(AppError::Unauthenticated);
        }
        match decode_access_token(state, token) {
            Ok(claims) => load_user(state, &claims.sub).await,
            Err(_) => auth_from_device(state, token).await,
        }
    }
}
