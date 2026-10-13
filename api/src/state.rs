use std::sync::Arc;

use sqlx::SqlitePool;

use crate::ai::{AiGateway, QingxinAiGateway};
use crate::config::Config;
use crate::crypto::FieldCrypto;
use crate::db;
use crate::error::AppError;
use crate::moderation::{Moderator, NoopModerator};
use crate::push::{LogPushSender, PushSender, RecordingPushSender};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Config,
    pub crypto: FieldCrypto,
    pub ai: Arc<dyn AiGateway>,
    pub moderator: Arc<dyn Moderator>,
    pub push: Arc<dyn PushSender>,
}

impl AppState {
    pub async fn connect(config: Config) -> Result<Self, AppError> {
        let pool = db::connect(&config.database_url)
            .await
            .map_err(|err| AppError::Unavailable(err.to_string()))?;
        let crypto = FieldCrypto::new(config.data_key, config.lookup_key);
        let push: Arc<dyn PushSender> = if config.recording_push {
            Arc::new(RecordingPushSender::default())
        } else {
            Arc::new(LogPushSender)
        };
        Ok(Self {
            pool,
            config,
            crypto,
            ai: Arc::new(QingxinAiGateway::from_env()),
            moderator: Arc::new(NoopModerator),
            push,
        })
    }
}
