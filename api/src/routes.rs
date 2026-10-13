use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use chrono::{Duration, SecondsFormat, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::ai::{AiError, CompletionRequest};
use crate::auth::{
    hash_password, issue_access_token, issue_refresh_token, revoke_refresh_token,
    rotate_refresh_token, verify_password, AuthUser,
};
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{
    new_id, normalize_display_name, normalize_email, normalize_phone, now_rfc3339, random_token,
    require_password, sha256_hex,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/v1/auth/register", post(register))
        .route("/v1/auth/login", post(login))
        .route("/v1/auth/refresh", post(refresh))
        .route("/v1/auth/logout", post(logout))
        .route("/v1/auth/sms/request", post(sms_request))
        .route("/v1/auth/sms/verify", post(sms_verify))
        .route("/v1/me", get(me))
        .route("/v1/privacy/consent", get(get_consent).post(post_consent))
        .route("/v1/privacy/export", get(export_data))
        .route("/v1/privacy/account", delete(delete_account))
        .route("/v1/caregiver/invites", post(create_invite))
        .route("/v1/caregiver/accept", post(accept_invite))
        .route("/v1/caregiver/links", get(list_links))
        .route("/v1/caregiver/links/{id}", delete(delete_link))
        .route("/v1/devices", get(list_devices).post(create_device))
        .route("/v1/devices/{id}", delete(revoke_device))
        .route("/v1/push/vapid-public-key", get(vapid_public_key))
        .route("/v1/push/subscribe", post(subscribe_push))
        .route("/v1/push/subscriptions/{id}", delete(unsubscribe_push))
        .route("/v1/jobs", get(list_jobs).post(create_job))
        .route("/v1/jobs/{id}", delete(cancel_job))
        .route("/v1/ai/complete", post(ai_complete))
        .merge(crate::finance::router())
        .merge(crate::elder::router())
        .merge(crate::mood::routes())
        .merge(crate::hustle::routes())
        .merge(crate::local::routes())
        .merge(crate::wellness::router())
        .merge(crate::study::router())
}

#[derive(FromRow)]
struct UserRow {
    id: String,
    email: Option<String>,
    password_hash: Option<String>,
    display_name: String,
    phone_encrypted: Option<Vec<u8>>,
    created_at: String,
}

#[derive(Serialize)]
struct UserPublic {
    id: String,
    email: Option<String>,
    display_name: String,
    phone: Option<String>,
    created_at: String,
}

impl UserRow {
    fn public(&self, crypto: &FieldCrypto) -> UserPublic {
        let phone = self.phone_encrypted.as_deref().and_then(|blob| {
            crypto
                .decrypt(blob)
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
        });
        UserPublic {
            id: self.id.clone(),
            email: self.email.clone(),
            display_name: self.display_name.clone(),
            phone,
            created_at: self.created_at.clone(),
        }
    }
}

#[derive(Serialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    token_type: String,
    expires_in: i64,
    user: UserPublic,
}

#[derive(Deserialize)]
struct ConsentBody {
    policy_version: String,
}

#[derive(Deserialize)]
struct RegisterBody {
    email: String,
    password: String,
    display_name: String,
    consent: ConsentBody,
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct RefreshBody {
    refresh_token: String,
}

#[derive(Deserialize)]
struct SmsRequestBody {
    phone: String,
    consent: Option<ConsentBody>,
}

#[derive(Deserialize)]
struct SmsVerifyBody {
    phone: String,
    code: String,
    display_name: Option<String>,
    consent: Option<ConsentBody>,
}

#[derive(Deserialize)]
struct AcceptInviteBody {
    code: String,
}

#[derive(Deserialize)]
struct CreateDeviceBody {
    user_id: Option<String>,
    label: String,
    ttl_seconds: Option<i64>,
}

#[derive(Deserialize)]
struct PushKeys {
    p256dh: String,
    auth: String,
}

#[derive(Deserialize)]
struct PushSubscribeBody {
    endpoint: String,
    keys: PushKeys,
}

#[derive(Deserialize)]
struct CreateJobBody {
    kind: String,
    run_at: String,
    payload: Option<Value>,
}

async fn load_user(state: &AppState, user_id: &str) -> Result<UserRow, AppError> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, email, password_hash, display_name, phone_encrypted, created_at FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn tokens_for(
    state: &AppState,
    user: &UserRow,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let (access_token, expires_in) =
        issue_access_token(state, &user.id, user.email.as_deref(), &user.display_name)?;
    let refresh_token = issue_refresh_token(state, &user.id, None).await?;
    Ok((
        StatusCode::OK,
        Json(TokenResponse {
            access_token,
            refresh_token,
            token_type: "Bearer".into(),
            expires_in,
            user: user.public(&state.crypto),
        }),
    ))
}

async fn insert_consent(
    state: &AppState,
    user_id: &str,
    policy_version: &str,
) -> Result<(), AppError> {
    let version = policy_version.trim();
    if version.is_empty() {
        return Err(AppError::InvalidRequest(
            "policy_version is required".into(),
        ));
    }
    sqlx::query(
        "INSERT INTO privacy_consents (id, user_id, policy_version, accepted_at) VALUES (?, ?, ?, ?)",
    )
    .bind(new_id())
    .bind(user_id)
    .bind(version)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

async fn health(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    match sqlx::query("SELECT 1").fetch_one(&state.pool).await {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({"status": "ok", "service": "qingxin-api", "db": "ok"})),
        ),
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"status": "degraded", "service": "qingxin-api", "db": "error"})),
        ),
    }
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterBody>,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let email = normalize_email(&body.email)?;
    require_password(&body.password)?;
    let display_name = normalize_display_name(&body.display_name)?;
    let password_hash = hash_password(&body.password)?;
    let now = now_rfc3339();
    let id = new_id();
    sqlx::query(
        "INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&email)
    .bind(&password_hash)
    .bind(&display_name)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    insert_consent(&state, &id, &body.consent.policy_version).await?;
    let user = load_user(&state, &id).await?;
    let (_, tokens) = tokens_for(&state, &user).await?;
    Ok((StatusCode::CREATED, tokens))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let email = normalize_email(&body.email)?;
    let user = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, password_hash, display_name, phone_encrypted, created_at FROM users WHERE email = ?",
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some(user) = user else {
        return Err(AppError::InvalidCredentials);
    };
    let Some(hash) = user.password_hash.as_deref() else {
        return Err(AppError::InvalidCredentials);
    };
    if !verify_password(&body.password, hash)? {
        return Err(AppError::InvalidCredentials);
    }
    tokens_for(&state, &user).await
}

async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshBody>,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let (user_id, refresh_token) = rotate_refresh_token(&state, &body.refresh_token).await?;
    let user = load_user(&state, &user_id).await?;
    let (access_token, expires_in) =
        issue_access_token(&state, &user.id, user.email.as_deref(), &user.display_name)?;
    Ok((
        StatusCode::OK,
        Json(TokenResponse {
            access_token,
            refresh_token,
            token_type: "Bearer".into(),
            expires_in,
            user: user.public(&state.crypto),
        }),
    ))
}

async fn logout(
    State(state): State<AppState>,
    Json(body): Json<RefreshBody>,
) -> Result<StatusCode, AppError> {
    revoke_refresh_token(&state, &body.refresh_token).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn sms_request(
    State(state): State<AppState>,
    Json(body): Json<SmsRequestBody>,
) -> Result<Json<Value>, AppError> {
    let phone = normalize_phone(&body.phone)?;
    let lookup = state.crypto.lookup_hash(&phone);
    let code = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000));
    let expires = Utc::now() + Duration::seconds(state.config.sms_ttl_secs);
    sqlx::query(
        "INSERT INTO sms_otps (id, phone_lookup, code_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(new_id())
    .bind(&lookup)
    .bind(sha256_hex(format!("{lookup}:{code}").as_bytes()))
    .bind(expires.to_rfc3339_opts(SecondsFormat::Secs, true))
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let _ = body.consent;
    let mut response = json!({"status": "sent"});
    if state.config.sms_stub {
        response["dev_code"] = Value::String(code);
    }
    Ok(Json(response))
}

async fn sms_verify(
    State(state): State<AppState>,
    Json(body): Json<SmsVerifyBody>,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let phone = normalize_phone(&body.phone)?;
    let lookup = state.crypto.lookup_hash(&phone);
    let now = now_rfc3339();
    let otp = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM sms_otps
         WHERE phone_lookup = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&lookup)
    .bind(sha256_hex(
        format!("{lookup}:{}", body.code.trim()).as_bytes(),
    ))
    .bind(&now)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some((otp_id,)) = otp else {
        return Err(AppError::InvalidCredentials);
    };
    sqlx::query("UPDATE sms_otps SET consumed_at = ? WHERE id = ?")
        .bind(&now)
        .bind(otp_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;

    let existing = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, password_hash, display_name, phone_encrypted, created_at FROM users WHERE phone_lookup = ?",
    )
    .bind(&lookup)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;

    let user = if let Some(user) = existing {
        user
    } else {
        let display_name =
            normalize_display_name(body.display_name.as_deref().unwrap_or("轻心用户"))?;
        let consent = body
            .consent
            .as_ref()
            .ok_or_else(|| AppError::InvalidRequest("consent is required".into()))?;
        let id = new_id();
        let encrypted = state.crypto.encrypt(phone.as_bytes())?;
        sqlx::query(
            "INSERT INTO users (id, display_name, phone_encrypted, phone_lookup, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&display_name)
        .bind(&encrypted)
        .bind(&lookup)
        .bind(&now)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        insert_consent(&state, &id, &consent.policy_version).await?;
        load_user(&state, &id).await?
    };
    tokens_for(&state, &user).await
}

async fn me(State(state): State<AppState>, user: AuthUser) -> Result<Json<UserPublic>, AppError> {
    let row = load_user(&state, &user.user_id).await?;
    Ok(Json(row.public(&state.crypto)))
}

#[derive(FromRow, Serialize)]
struct ConsentRow {
    id: String,
    user_id: String,
    policy_version: String,
    accepted_at: String,
}

async fn get_consent(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<ConsentRow>, AppError> {
    sqlx::query_as::<_, ConsentRow>(
        "SELECT id, user_id, policy_version, accepted_at FROM privacy_consents
         WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1",
    )
    .bind(&user.user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .map(Json)
    .ok_or(AppError::NotFound)
}

async fn post_consent(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ConsentBody>,
) -> Result<(StatusCode, Json<ConsentRow>), AppError> {
    insert_consent(&state, &user.user_id, &body.policy_version).await?;
    let row = sqlx::query_as::<_, ConsentRow>(
        "SELECT id, user_id, policy_version, accepted_at FROM privacy_consents
         WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1",
    )
    .bind(&user.user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[derive(FromRow, Serialize)]
struct DeviceRow {
    id: String,
    user_id: String,
    issued_by_user_id: String,
    label: String,
    expires_at: Option<String>,
    last_used_at: Option<String>,
    created_at: String,
}

#[derive(FromRow, Serialize)]
struct JobRow {
    id: String,
    user_id: String,
    kind: String,
    payload_json: String,
    run_at: String,
    status: String,
    attempts: i64,
    last_error: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
struct JobPublic {
    id: String,
    user_id: String,
    kind: String,
    run_at: String,
    status: String,
    attempts: i64,
    payload: Value,
    last_error: Option<String>,
    created_at: String,
}

impl JobRow {
    fn public(&self) -> JobPublic {
        JobPublic {
            id: self.id.clone(),
            user_id: self.user_id.clone(),
            kind: self.kind.clone(),
            run_at: self.run_at.clone(),
            status: self.status.clone(),
            attempts: self.attempts,
            payload: serde_json::from_str(&self.payload_json).unwrap_or(Value::Null),
            last_error: self.last_error.clone(),
            created_at: self.created_at.clone(),
        }
    }
}

#[derive(FromRow, Serialize)]
struct PushRow {
    id: String,
    endpoint: String,
    created_at: String,
}

async fn export_data(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let profile = load_user(&state, &user.user_id).await?;
    let consents = sqlx::query_as::<_, ConsentRow>(
        "SELECT id, user_id, policy_version, accepted_at FROM privacy_consents WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let devices = sqlx::query_as::<_, DeviceRow>(
        "SELECT id, user_id, issued_by_user_id, label, expires_at, last_used_at, created_at
         FROM device_sessions WHERE user_id = ? AND revoked_at IS NULL",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let jobs = sqlx::query_as::<_, JobRow>(
        "SELECT id, user_id, kind, payload_json, run_at, status, attempts, last_error, created_at
         FROM scheduled_jobs WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let push_subscriptions = sqlx::query_as::<_, PushRow>(
        "SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ?",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let finance = crate::finance::export_for_user(&state, &user.user_id).await?;
    let wellness = crate::wellness::export_for_user(&state, &user.user_id).await?;
    let study = crate::study::export_for_user(&state, &user.user_id).await?;
    let mood_logs = crate::mood::export_mood(&state, &user.user_id).await?;
    let meditation_sessions = crate::mood::export_sessions(&state, &user.user_id).await?;
    let applications = crate::hustle::export_applications(&state, &user.user_id).await?;
    let resumes = crate::hustle::export_resumes(&state, &user.user_id).await?;
    let side_hustles = crate::hustle::export_side_hustles(&state, &user.user_id).await?;
    let local_reviews = crate::local::export_reviews(&state, &user.user_id).await?;
    let local_services = crate::local::export_services(&state, &user.user_id).await?;
    let local_corrections = crate::local::export_corrections(&state, &user.user_id).await?;
    Ok(Json(json!({
        "exported_at": now_rfc3339(),
        "user": profile.public(&state.crypto),
        "consents": consents,
        "devices": devices,
        "jobs": jobs.iter().map(JobRow::public).collect::<Vec<_>>(),
        "push_subscriptions": push_subscriptions,
        "finance": finance,
        "wellness": wellness,
        "study": study,
        "mood_logs": mood_logs,
        "meditation_sessions": meditation_sessions,
        "applications": applications,
        "resumes": resumes,
        "side_hustles": side_hustles,
        "local_reviews": local_reviews,
        "local_services": local_services,
        "local_corrections": local_corrections,
    })))
}

async fn delete_account(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

fn invite_code() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char)
        .collect()
}

async fn create_invite(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let code = invite_code();
    let expires = Utc::now() + Duration::seconds(state.config.invite_ttl_secs);
    sqlx::query(
        "INSERT INTO caregiver_invites (id, dependent_user_id, code_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(new_id())
    .bind(&user.user_id)
    .bind(sha256_hex(code.as_bytes()))
    .bind(expires.to_rfc3339_opts(SecondsFormat::Secs, true))
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "code": code,
            "expires_at": expires.to_rfc3339_opts(SecondsFormat::Secs, true)
        })),
    ))
}

#[derive(FromRow, Serialize)]
struct LinkRow {
    id: String,
    caregiver_user_id: String,
    dependent_user_id: String,
    created_at: String,
}

async fn accept_invite(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<AcceptInviteBody>,
) -> Result<(StatusCode, Json<LinkRow>), AppError> {
    let code = body.code.trim().to_ascii_uppercase();
    let now = now_rfc3339();
    let invite = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT id, dependent_user_id, consumed_at FROM caregiver_invites
         WHERE code_hash = ? AND expires_at > ?",
    )
    .bind(sha256_hex(code.as_bytes()))
    .bind(&now)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some((invite_id, dependent_id, consumed_at)) = invite else {
        return Err(AppError::NotFound);
    };
    if consumed_at.is_some() {
        return Err(AppError::Conflict);
    }
    if dependent_id == user.user_id {
        return Err(AppError::Conflict);
    }
    let id = new_id();
    sqlx::query(
        "INSERT INTO caregiver_links (id, caregiver_user_id, dependent_user_id, created_at)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&dependent_id)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sqlx::query("UPDATE caregiver_invites SET consumed_at = ? WHERE id = ?")
        .bind(&now)
        .bind(invite_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    let link = sqlx::query_as::<_, LinkRow>(
        "SELECT id, caregiver_user_id, dependent_user_id, created_at FROM caregiver_links WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(link)))
}

async fn list_links(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let items = sqlx::query_as::<_, LinkRow>(
        "SELECT id, caregiver_user_id, dependent_user_id, created_at FROM caregiver_links
         WHERE caregiver_user_id = ? OR dependent_user_id = ?",
    )
    .bind(&user.user_id)
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({ "items": items })))
}

async fn delete_link(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        "DELETE FROM caregiver_links WHERE id = ? AND (caregiver_user_id = ? OR dependent_user_id = ?)",
    )
    .bind(id)
    .bind(&user.user_id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn is_caregiver(
    state: &AppState,
    caregiver: &str,
    dependent: &str,
) -> Result<bool, AppError> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM caregiver_links WHERE caregiver_user_id = ? AND dependent_user_id = ?",
    )
    .bind(caregiver)
    .bind(dependent)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(count > 0)
}

async fn create_device(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateDeviceBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let label = body.label.trim();
    if label.is_empty() {
        return Err(AppError::InvalidRequest("label is required".into()));
    }
    let target = body
        .user_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&user.user_id);
    if target != user.user_id && !is_caregiver(&state, &user.user_id, target).await? {
        return Err(AppError::Forbidden);
    }
    let ttl = body.ttl_seconds.unwrap_or(state.config.device_ttl_secs);
    if ttl <= 0 {
        return Err(AppError::InvalidRequest(
            "ttl_seconds must be positive".into(),
        ));
    }
    let token = random_token();
    let id = new_id();
    let now = now_rfc3339();
    let expires = Utc::now() + Duration::seconds(ttl);
    sqlx::query(
        "INSERT INTO device_sessions
            (id, user_id, issued_by_user_id, label, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(target)
    .bind(&user.user_id)
    .bind(label)
    .bind(sha256_hex(token.as_bytes()))
    .bind(expires.to_rfc3339_opts(SecondsFormat::Secs, true))
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": id,
            "user_id": target,
            "issued_by_user_id": user.user_id,
            "label": label,
            "expires_at": expires.to_rfc3339_opts(SecondsFormat::Secs, true),
            "last_used_at": Value::Null,
            "created_at": now,
            "token": token,
        })),
    ))
}

async fn list_devices(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    let items = sqlx::query_as::<_, DeviceRow>(
        "SELECT id, user_id, issued_by_user_id, label, expires_at, last_used_at, created_at
         FROM device_sessions
         WHERE revoked_at IS NULL AND (user_id = ? OR issued_by_user_id = ?)",
    )
    .bind(&user.user_id)
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({ "items": items })))
}

async fn revoke_device(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let row = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT user_id, issued_by_user_id, revoked_at FROM device_sessions WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let Some((target, issued_by, revoked_at)) = row else {
        return Err(AppError::NotFound);
    };
    if revoked_at.is_some() {
        return Err(AppError::NotFound);
    }
    let allowed = user.user_id == target
        || user.user_id == issued_by
        || is_caregiver(&state, &user.user_id, &target).await?;
    if !allowed {
        return Err(AppError::Forbidden);
    }
    sqlx::query("UPDATE device_sessions SET revoked_at = ? WHERE id = ?")
        .bind(now_rfc3339())
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn vapid_public_key(State(state): State<AppState>) -> Json<Value> {
    Json(json!({ "public_key": state.config.vapid_public_key }))
}

async fn subscribe_push(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PushSubscribeBody>,
) -> Result<(StatusCode, Json<PushRow>), AppError> {
    if body.endpoint.trim().is_empty() || body.keys.p256dh.is_empty() || body.keys.auth.is_empty() {
        return Err(AppError::InvalidRequest("subscription is invalid".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(body.endpoint.trim())
    .bind(&body.keys.p256dh)
    .bind(&body.keys.auth)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, PushRow>(
        "SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
    )
    .bind(&user.user_id)
    .bind(body.endpoint.trim())
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row)))
}

async fn unsubscribe_push(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?")
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

async fn create_job(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateJobBody>,
) -> Result<(StatusCode, Json<JobPublic>), AppError> {
    if body.kind != "web_push" {
        return Err(AppError::InvalidRequest("kind must be web_push".into()));
    }
    let run_at = chrono::DateTime::parse_from_rfc3339(&body.run_at)
        .map_err(|_| AppError::InvalidRequest("run_at must be RFC3339".into()))?
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    let payload = body.payload.unwrap_or(json!({}));
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO scheduled_jobs
            (id, user_id, kind, payload_json, run_at, status, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&body.kind)
    .bind(payload.to_string())
    .bind(&run_at)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let row = sqlx::query_as::<_, JobRow>(
        "SELECT id, user_id, kind, payload_json, run_at, status, attempts, last_error, created_at
         FROM scheduled_jobs WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

async fn list_jobs(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query_as::<_, JobRow>(
        "SELECT id, user_id, kind, payload_json, run_at, status, attempts, last_error, created_at
         FROM scheduled_jobs WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let items: Vec<JobPublic> = rows.iter().map(JobRow::public).collect();
    Ok(Json(json!({ "items": items })))
}

async fn cancel_job(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        "UPDATE scheduled_jobs SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'",
    )
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

async fn ai_complete(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CompletionRequest>,
) -> Result<Json<Value>, AppError> {
    match state.ai.complete(&user.user_id, body).await {
        Ok(done) => Ok(Json(serde_json::to_value(done).unwrap_or(Value::Null))),
        Err(AiError::Unconfigured) => Err(AppError::AiUnconfigured),
        Err(AiError::Failed(msg)) => Err(AppError::Unavailable(msg)),
    }
}
