//! Types that match T1's `api/src/ai.rs` HTTP body so hookup is a thin map.
//!
//! `POST /v1/ai/complete` passes `AuthUser.user_id` into
//! [`Gateway::complete_for_user`].

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::ai::Ai;
use crate::error::AiError as GatewayError;
use crate::types::{
    ChatMessage as SeamMessage, ChatRequest, Role, TokenUsage as SeamUsage, UserId,
};

/// Forge `ChatMessage` (role is a string in OpenAPI).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    /// `system`, `user`, or `assistant`.
    pub role: String,
    /// Message text.
    pub content: String,
}

/// Forge `CompletionRequest`. No user id — that comes from the JWT.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompletionRequest {
    /// Conversation.
    pub messages: Vec<ChatMessage>,
    /// Optional model override.
    pub model: Option<String>,
}

/// Forge `TokenUsage` (i64 in their crate).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TokenUsage {
    /// Prompt tokens.
    pub prompt_tokens: i64,
    /// Completion tokens.
    pub completion_tokens: i64,
}

/// Forge `CompletionResponse`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompletionResponse {
    /// Assistant text.
    pub content: String,
    /// Model name if known.
    pub model: Option<String>,
    /// Optional usage.
    pub usage: Option<TokenUsage>,
}

/// Forge `AiError`.
#[derive(Debug, thiserror::Error)]
pub enum AiError {
    /// Their default stub. This crate never returns it.
    #[error("ai gateway is not configured")]
    Unconfigured,
    /// Provider / validation / rate-limit failure (no secrets).
    #[error("{0}")]
    Failed(String),
}

/// Forge `AiGateway` trait (complete only).
#[async_trait]
pub trait AiGateway: Send + Sync {
    /// Non-streaming completion.
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse, AiError>;
}

impl From<GatewayError> for AiError {
    fn from(err: GatewayError) -> Self {
        AiError::Failed(err.to_string())
    }
}

fn map_role(role: &str) -> Result<Role, AiError> {
    match role {
        "system" => Ok(Role::System),
        "user" => Ok(Role::User),
        "assistant" => Ok(Role::Assistant),
        other => Err(AiError::Failed(format!("unknown role: {other}"))),
    }
}

impl CompletionRequest {
    fn into_seam(self, user_id: UserId) -> Result<ChatRequest, AiError> {
        let mut messages = Vec::with_capacity(self.messages.len());
        for message in self.messages {
            messages.push(SeamMessage {
                role: map_role(&message.role)?,
                content: message.content,
            });
        }
        Ok(ChatRequest {
            user_id,
            messages,
            model: self.model,
        })
    }
}

fn map_response(response: crate::types::ChatResponse) -> CompletionResponse {
    CompletionResponse {
        content: response.content,
        model: Some(response.provider.as_str().to_string()),
        usage: Some(TokenUsage {
            prompt_tokens: i64::from(response.usage.prompt_tokens),
            completion_tokens: i64::from(response.usage.completion_tokens),
        }),
    }
}

impl crate::Gateway {
    /// Hook for Forge's route: pass `AuthUser.user_id` plus their request body.
    pub async fn complete_for_user(
        &self,
        user_id: impl AsRef<str>,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        let user_id = UserId::new(user_id.as_ref()).map_err(AiError::from)?;
        let seam = request.into_seam(user_id)?;
        let response = Ai::complete(self, seam).await?;
        Ok(map_response(response))
    }

    /// Streaming hook for M5 toolbox runs. Same mapping as [`Self::complete_for_user`].
    pub async fn stream_for_user(
        &self,
        user_id: impl AsRef<str>,
        request: CompletionRequest,
    ) -> Result<crate::ChatStream, AiError> {
        let user_id = UserId::new(user_id.as_ref()).map_err(AiError::from)?;
        let seam = request.into_seam(user_id)?;
        Ai::stream(self, seam).await.map_err(AiError::from)
    }
}

/// `Arc<dyn crate::forge::AiGateway>` stand-in. Uses `"anonymous"` when the
/// HTTP layer has not yet threaded the JWT user id (Forge currently binds
/// `_user`). Prefer [`crate::Gateway::complete_for_user`] in the handler.
pub struct ForgeGateway {
    inner: crate::Gateway,
}

impl ForgeGateway {
    /// Wrap a configured [`crate::Gateway`].
    pub fn new(inner: crate::Gateway) -> Self {
        Self { inner }
    }
}

#[async_trait]
impl AiGateway for ForgeGateway {
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse, AiError> {
        self.inner.complete_for_user("anonymous", req).await
    }
}

impl From<SeamUsage> for TokenUsage {
    fn from(usage: SeamUsage) -> Self {
        Self {
            prompt_tokens: i64::from(usage.prompt_tokens),
            completion_tokens: i64::from(usage.completion_tokens),
        }
    }
}
