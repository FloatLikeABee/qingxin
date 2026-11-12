use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::ai::{AiError, ChatMessage, CompletionRequest};
use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

pub const DISCLAIMER: &str = "秘密信箱不是心理咨询或危机干预。如需即时帮助，请拨打 12356。";

const MAX_BODY_CHARS: usize = 4000;

#[derive(Clone, FromRow)]
struct LetterRow {
    id: String,
    pair_id: String,
    role: String,
    title: String,
    body_encrypted: Vec<u8>,
    consented_at: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct PostLetterBody {
    title: Option<String>,
    body: String,
    consent: bool,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/v1/secrets/letters", get(list_letters).post(post_letter))
}

fn require_encrypt(
    crypto: &FieldCrypto,
    raw: &str,
    max_chars: usize,
    field: &str,
) -> Result<Vec<u8>, AppError> {
    let text = raw.trim();
    if text.is_empty() {
        return Err(AppError::InvalidRequest(format!("{field} is required")));
    }
    if text.chars().count() > max_chars {
        return Err(AppError::InvalidRequest(format!(
            "{field} must be at most {max_chars} characters"
        )));
    }
    crypto.encrypt(text.as_bytes())
}

fn decrypt_text(crypto: &FieldCrypto, blob: &[u8]) -> String {
    crypto
        .decrypt(blob)
        .ok()
        .and_then(|plain| String::from_utf8(plain).ok())
        .unwrap_or_default()
}

fn fallback_reply() -> String {
    [
        "亲爱的来信人：",
        "",
        "信已收到。我会把这些字留在只有你能打开的格子里。",
        "",
        "你愿意把心里的话交给纸面，这件事本身已经很轻、也很勇敢。",
        "",
        "此致",
        "轻心信箱",
    ]
    .join("\n")
}

fn as_letter(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.contains("此致") && trimmed.contains("亲爱的来信人") {
        return trimmed.to_string();
    }
    format!("亲爱的来信人：\n\n{trimmed}\n\n此致\n轻心信箱")
}

async fn complete_or_mock(
    state: &AppState,
    user_id: &str,
    prompt: String,
    fallback: String,
) -> Result<String, AppError> {
    let req = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: prompt,
        }],
        model: Some("qingxin-secrets".into()),
    };
    match state.ai.complete(user_id, req).await {
        Ok(done) if !done.content.trim().is_empty() => Ok(done.content),
        Ok(_) | Err(AiError::Unconfigured) | Err(AiError::Failed(_)) => Ok(fallback),
    }
}

fn letter_public(crypto: &FieldCrypto, row: &LetterRow) -> Value {
    json!({
        "id": row.id,
        "role": row.role,
        "title": row.title,
        "body": decrypt_text(crypto, &row.body_encrypted),
        "consented_at": row.consented_at,
        "created_at": row.created_at
    })
}

fn thread_public(
    crypto: &FieldCrypto,
    pair_id: &str,
    secret: &LetterRow,
    reply: &LetterRow,
) -> Value {
    json!({
        "id": pair_id,
        "secret": letter_public(crypto, secret),
        "reply": letter_public(crypto, reply),
        "disclaimer": DISCLAIMER
    })
}

async fn load_user_rows(state: &AppState, user_id: &str) -> Result<Vec<LetterRow>, AppError> {
    sqlx::query_as::<_, LetterRow>(
        "SELECT id, pair_id, role, title, body_encrypted, consented_at, created_at
         FROM secret_letters WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

fn group_threads(crypto: &FieldCrypto, rows: Vec<LetterRow>) -> Vec<Value> {
    let mut secrets = Vec::new();
    let mut replies = std::collections::HashMap::new();
    for row in rows {
        if row.role == "reply" {
            replies.insert(row.pair_id.clone(), row);
        } else {
            secrets.push(row);
        }
    }
    let mut items = Vec::new();
    for secret in secrets {
        if let Some(reply) = replies.get(&secret.pair_id) {
            items.push(thread_public(crypto, &secret.pair_id, &secret, reply));
        }
    }
    items
}

pub async fn export_letters(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(group_threads(
        &state.crypto,
        load_user_rows(state, user_id).await?,
    ))
}

async fn list_letters(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "items": export_letters(&state, &user.user_id).await?
    })))
}

struct LetterInsert<'a> {
    user_id: &'a str,
    pair_id: &'a str,
    role: &'a str,
    title: &'a str,
    body: &'a str,
    consented_at: Option<&'a str>,
    created_at: &'a str,
}

async fn insert_letter(state: &AppState, draft: LetterInsert<'_>) -> Result<LetterRow, AppError> {
    let id = new_id();
    let blob = require_encrypt(&state.crypto, draft.body, MAX_BODY_CHARS, "body")?;
    sqlx::query(
        "INSERT INTO secret_letters
            (id, user_id, pair_id, role, title, body_encrypted, consented_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(draft.user_id)
    .bind(draft.pair_id)
    .bind(draft.role)
    .bind(draft.title)
    .bind(&blob)
    .bind(draft.consented_at)
    .bind(draft.created_at)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(LetterRow {
        id,
        pair_id: draft.pair_id.to_string(),
        role: draft.role.to_string(),
        title: draft.title.to_string(),
        body_encrypted: blob,
        consented_at: draft.consented_at.map(str::to_string),
        created_at: draft.created_at.to_string(),
    })
}

async fn post_letter(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PostLetterBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    if !body.consent {
        return Err(AppError::InvalidRequest(
            "请先同意把信用来写回信，且不会公开发布。".into(),
        ));
    }
    let text = body.body.trim();
    if text.is_empty() {
        return Err(AppError::InvalidRequest("请先写信，再投进信箱。".into()));
    }
    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("未署名的信")
        .to_string();
    let now = now_rfc3339();
    let pair_id = new_id();
    let prompt = format!(
        "写一封很短的中文回信。用「亲爱的来信人」开头，用「此致」和「轻心信箱」结尾。不要复述来信原文。来信大约 {} 字，只回应气氛，不要引用句子。",
        text.chars().count()
    );
    let reply_raw = complete_or_mock(&state, &user.user_id, prompt, fallback_reply()).await?;
    let reply_body = as_letter(&reply_raw);
    let secret = insert_letter(
        &state,
        LetterInsert {
            user_id: &user.user_id,
            pair_id: &pair_id,
            role: "secret",
            title: &title,
            body: text,
            consented_at: Some(&now),
            created_at: &now,
        },
    )
    .await?;
    let reply = insert_letter(
        &state,
        LetterInsert {
            user_id: &user.user_id,
            pair_id: &pair_id,
            role: "reply",
            title: "信箱回信",
            body: &reply_body,
            consented_at: None,
            created_at: &now,
        },
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(thread_public(&state.crypto, &pair_id, &secret, &reply)),
    ))
}
