//! Provider trait implemented by vendors and the mock.

use std::pin::Pin;

use async_trait::async_trait;
use futures::Stream;

use crate::error::ProviderError;
use crate::types::{ChatMessage, ProviderId, TokenUsage};

/// Request forwarded to a single provider.
#[derive(Clone, Debug)]
pub struct ProviderRequest {
    /// Conversation.
    pub messages: Vec<ChatMessage>,
    /// Model override.
    pub model: Option<String>,
}

/// Non-streaming provider result.
#[derive(Clone, Debug)]
pub struct ProviderResponse {
    /// Assistant text.
    pub content: String,
    /// Vendor or estimated usage.
    pub usage: TokenUsage,
}

/// Streaming provider event.
#[derive(Clone, Debug)]
pub enum ProviderDelta {
    /// Text fragment.
    Text(String),
    /// Final usage (optional; gateway estimates if omitted).
    Usage(TokenUsage),
}

/// Boxed provider stream.
pub type ProviderStream = Pin<Box<dyn Stream<Item = Result<ProviderDelta, ProviderError>> + Send>>;

/// One OpenAI-compatible (or mock) backend.
#[async_trait]
pub trait Provider: Send + Sync {
    /// Stable id used in responses and logs.
    fn id(&self) -> &ProviderId;

    /// Full chat completion.
    async fn chat(&self, request: &ProviderRequest) -> Result<ProviderResponse, ProviderError>;

    /// Streaming chat completion.
    async fn chat_stream(&self, request: &ProviderRequest)
        -> Result<ProviderStream, ProviderError>;
}
