use std::pin::Pin;

use async_trait::async_trait;
use futures::Stream;
use futures::StreamExt;
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

#[derive(Debug, Clone)]
pub enum StreamChunk {
    Delta { text: String },
    End,
}

pub type CompletionStream = Pin<Box<dyn Stream<Item = Result<StreamChunk, AiError>> + Send>>;

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

    async fn stream(
        &self,
        user_id: &str,
        req: CompletionRequest,
    ) -> Result<CompletionStream, AiError> {
        let done = self.complete(user_id, req).await?;
        let chunks = vec![
            Ok(StreamChunk::Delta { text: done.content }),
            Ok(StreamChunk::End),
        ];
        Ok(Box::pin(futures::stream::iter(chunks)))
    }
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

fn map_forge_request(req: CompletionRequest) -> qingxin_ai_gateway::forge::CompletionRequest {
    qingxin_ai_gateway::forge::CompletionRequest {
        messages: req
            .messages
            .into_iter()
            .map(|m| qingxin_ai_gateway::forge::ChatMessage {
                role: m.role,
                content: m.content,
            })
            .collect(),
        model: req.model,
    }
}

fn map_forge_error(err: qingxin_ai_gateway::forge::AiError) -> AiError {
    match err {
        qingxin_ai_gateway::forge::AiError::Unconfigured => AiError::Unconfigured,
        qingxin_ai_gateway::forge::AiError::Failed(msg) => AiError::Failed(msg),
    }
}

#[async_trait]
impl AiGateway for QingxinAiGateway {
    async fn complete(
        &self,
        user_id: &str,
        req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        match self
            .inner
            .complete_for_user(user_id, map_forge_request(req))
            .await
        {
            Ok(done) => Ok(CompletionResponse {
                content: done.content,
                model: done.model,
                usage: done.usage.map(|u| TokenUsage {
                    prompt_tokens: u.prompt_tokens,
                    completion_tokens: u.completion_tokens,
                }),
            }),
            Err(err) => Err(map_forge_error(err)),
        }
    }

    async fn stream(
        &self,
        user_id: &str,
        req: CompletionRequest,
    ) -> Result<CompletionStream, AiError> {
        let inner = self
            .inner
            .stream_for_user(user_id, map_forge_request(req))
            .await
            .map_err(map_forge_error)?;
        Ok(Box::pin(inner.map(|item| match item {
            Ok(qingxin_ai_gateway::ChatChunk::Delta { text }) => Ok(StreamChunk::Delta { text }),
            Ok(qingxin_ai_gateway::ChatChunk::End { .. }) => Ok(StreamChunk::End),
            Err(err) => Err(AiError::Failed(err.to_string())),
        })))
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
