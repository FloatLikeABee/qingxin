use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TokenUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompletionResponse {
    pub content: String,
    pub model: Option<String>,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("ai gateway is not configured")]
    Unconfigured,
    #[error("{0}")]
    Failed(String),
}

#[async_trait]
pub trait AiGateway: Send + Sync {
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse, AiError>;
}

pub struct UnconfiguredAiGateway;

#[async_trait]
impl AiGateway for UnconfiguredAiGateway {
    async fn complete(&self, _req: CompletionRequest) -> Result<CompletionResponse, AiError> {
        Err(AiError::Unconfigured)
    }
}
