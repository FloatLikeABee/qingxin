use async_trait::async_trait;
use serde_json::Value;
use std::sync::Mutex;

use crate::error::AppError;

#[derive(Clone, Debug)]
pub struct PushMessage {
    pub user_id: String,
    pub job_id: String,
    pub payload: Value,
}

#[async_trait]
pub trait PushSender: Send + Sync {
    async fn send(&self, message: &PushMessage) -> Result<(), AppError>;
    fn sent(&self) -> usize {
        0
    }
}

pub struct LogPushSender;

#[async_trait]
impl PushSender for LogPushSender {
    async fn send(&self, message: &PushMessage) -> Result<(), AppError> {
        tracing::info!(job_id = %message.job_id, user_id = %message.user_id, "web push job");
        Ok(())
    }
}

#[derive(Default)]
pub struct RecordingPushSender {
    messages: Mutex<Vec<PushMessage>>,
}

#[async_trait]
impl PushSender for RecordingPushSender {
    async fn send(&self, message: &PushMessage) -> Result<(), AppError> {
        self.messages
            .lock()
            .expect("push recorder lock")
            .push(message.clone());
        Ok(())
    }

    fn sent(&self) -> usize {
        self.messages.lock().expect("push recorder lock").len()
    }
}
