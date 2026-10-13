use anyhow::anyhow;
use base64::Engine;
use chrono::{SecondsFormat, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

pub fn decode_key32(raw: &str) -> anyhow::Result<[u8; 32]> {
    let trimmed = raw.trim();
    let bytes = if trimmed.len() == 64 && trimmed.bytes().all(|b| b.is_ascii_hexdigit()) {
        hex::decode(trimmed)?
    } else {
        base64::engine::general_purpose::STANDARD.decode(trimmed)?
    };
    bytes
        .try_into()
        .map_err(|_| anyhow!("encryption key must decode to 32 bytes"))
}

pub fn normalize_email(raw: &str) -> Result<String, crate::error::AppError> {
    let email = raw.trim().to_ascii_lowercase();
    let Some((local, domain)) = email.split_once('@') else {
        return Err(crate::error::AppError::InvalidRequest(
            "email is invalid".into(),
        ));
    };
    if local.is_empty()
        || domain.is_empty()
        || !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
    {
        return Err(crate::error::AppError::InvalidRequest(
            "email is invalid".into(),
        ));
    }
    Ok(email)
}

pub fn normalize_phone(raw: &str) -> Result<String, crate::error::AppError> {
    let trimmed = raw.trim();
    if !trimmed.starts_with('+') {
        return Err(crate::error::AppError::InvalidRequest(
            "phone must be E.164".into(),
        ));
    }
    let digits: String = trimmed.chars().filter(|c| c.is_ascii_digit()).collect();
    if !(8..=15).contains(&digits.len()) || digits.starts_with('0') {
        return Err(crate::error::AppError::InvalidRequest(
            "phone must be E.164".into(),
        ));
    }
    Ok(format!("+{digits}"))
}

pub fn normalize_display_name(raw: &str) -> Result<String, crate::error::AppError> {
    let name = raw.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(crate::error::AppError::InvalidRequest(
            "display_name is invalid".into(),
        ));
    }
    Ok(name.to_string())
}

pub fn require_password(raw: &str) -> Result<(), crate::error::AppError> {
    if raw.len() < 8 {
        return Err(crate::error::AppError::InvalidRequest(
            "password must be at least 8 characters".into(),
        ));
    }
    Ok(())
}
