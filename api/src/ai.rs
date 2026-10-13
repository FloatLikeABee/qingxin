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
    async fn complete(
        &self,
        user_id: &str,
        req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError>;
}

/// Default production gateway: Ollama first, then any vendor that has an env key.
pub struct QingxinAiGateway {
    inner: qingxin_ai_gateway::Gateway,
}

impl QingxinAiGateway {
    /// `GatewayConfig::from_env()` — Ollama is always present; keys are optional.
    pub fn from_env() -> Self {
        Self {
            inner: qingxin_ai_gateway::Gateway::from_config(
                qingxin_ai_gateway::GatewayConfig::from_env(),
            ),
        }
    }

    /// In-process mock. Tests use this so `/v1/ai/complete` needs no network.
    pub fn mock(text: impl Into<String>) -> Self {
        Self::from_gateway(
            qingxin_ai_gateway::Gateway::builder()
                .provider(qingxin_ai_gateway::MockProvider::named("mock").text(text))
                .build(),
        )
    }

    /// Mock with a tight per-user limit (used to prove `user_id` is threaded).
    pub fn mock_rate_limited(text: impl Into<String>, max: u32) -> Self {
        Self::from_gateway(
            qingxin_ai_gateway::Gateway::builder()
                .rate_limit(max, std::time::Duration::from_secs(60))
                .provider(qingxin_ai_gateway::MockProvider::named("mock").text(text))
                .build(),
        )
    }

    pub fn from_gateway(inner: qingxin_ai_gateway::Gateway) -> Self {
        Self { inner }
    }
}

#[async_trait]
impl AiGateway for QingxinAiGateway {
    async fn complete(
        &self,
        user_id: &str,
        req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        let mapped = qingxin_ai_gateway::forge::CompletionRequest {
            messages: req
                .messages
                .into_iter()
                .map(|m| qingxin_ai_gateway::forge::ChatMessage {
                    role: m.role,
                    content: m.content,
                })
                .collect(),
            model: req.model,
        };
        match self.inner.complete_for_user(user_id, mapped).await {
            Ok(done) => Ok(CompletionResponse {
                content: done.content,
                model: done.model,
                usage: done.usage.map(|u| TokenUsage {
                    prompt_tokens: u.prompt_tokens,
                    completion_tokens: u.completion_tokens,
                }),
            }),
            Err(qingxin_ai_gateway::forge::AiError::Unconfigured) => Err(AiError::Unconfigured),
            Err(qingxin_ai_gateway::forge::AiError::Failed(msg)) => Err(AiError::Failed(msg)),
        }
    }
}

pub struct UnconfiguredAiGateway;

#[async_trait]
impl AiGateway for UnconfiguredAiGateway {
    async fn complete(
        &self,
        _user_id: &str,
        _req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        Err(AiError::Unconfigured)
    }
}
