use anyhow::{anyhow, Context};

use crate::util::decode_key32;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub listen_addr: String,
    pub jwt_secret: String,
    pub access_ttl_secs: i64,
    pub refresh_ttl_secs: i64,
    pub device_ttl_secs: i64,
    pub invite_ttl_secs: i64,
    pub sms_ttl_secs: i64,
    pub data_key: [u8; 32],
    pub lookup_key: [u8; 32],
    pub sms_stub: bool,
    pub vapid_public_key: String,
    pub scheduler_interval_ms: u64,
    pub recording_push: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
        let host = std::env::var("BIND_HOST").unwrap_or_else(|_| "0.0.0.0".into());
        let data_key = decode_key32(
            &std::env::var("QINGXIN_DATA_KEY").context("QINGXIN_DATA_KEY is required")?,
        )?;
        let lookup_key = decode_key32(
            &std::env::var("QINGXIN_LOOKUP_KEY").context("QINGXIN_LOOKUP_KEY is required")?,
        )?;
        let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET is required")?;
        if jwt_secret.len() < 32 {
            return Err(anyhow!("JWT_SECRET must be at least 32 bytes"));
        }
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://qingxin.db?mode=rwc".into()),
            listen_addr: format!("{host}:{port}"),
            jwt_secret,
            access_ttl_secs: env_i64("JWT_ACCESS_TTL_SECS", 900),
            refresh_ttl_secs: env_i64("JWT_REFRESH_TTL_SECS", 2_592_000),
            device_ttl_secs: env_i64("DEVICE_TTL_SECS", 31_536_000),
            invite_ttl_secs: env_i64("CAREGIVER_INVITE_TTL_SECS", 86_400),
            sms_ttl_secs: env_i64("SMS_TTL_SECS", 300),
            data_key,
            lookup_key,
            sms_stub: std::env::var("QINGXIN_SMS_STUB")
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            vapid_public_key: std::env::var("VAPID_PUBLIC_KEY").unwrap_or_default(),
            scheduler_interval_ms: env_u64("SCHEDULER_INTERVAL_MS", 5_000),
            recording_push: false,
        })
    }

    pub fn test() -> Self {
        Self {
            database_url: "sqlite::memory:".into(),
            listen_addr: "127.0.0.1:0".into(),
            jwt_secret: "test-jwt-secret-key-32-bytes-min!".into(),
            access_ttl_secs: 900,
            refresh_ttl_secs: 3_600,
            device_ttl_secs: 86_400,
            invite_ttl_secs: 86_400,
            sms_ttl_secs: 300,
            data_key: [7u8; 32],
            lookup_key: [11u8; 32],
            sms_stub: true,
            vapid_public_key: "test-vapid-public".into(),
            scheduler_interval_ms: 50,
            recording_push: true,
        }
    }
}

fn env_i64(name: &str, default: i64) -> i64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

impl Config {
    pub fn encoding_key(&self) -> jsonwebtoken::EncodingKey {
        jsonwebtoken::EncodingKey::from_secret(self.jwt_secret.as_bytes())
    }

    pub fn decoding_key(&self) -> jsonwebtoken::DecodingKey {
        jsonwebtoken::DecodingKey::from_secret(self.jwt_secret.as_bytes())
    }
}
