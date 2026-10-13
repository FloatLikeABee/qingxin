//! The `Ai` seam Forge's API skeleton depends on.

use async_trait::async_trait;

use crate::error::AiError;
use crate::types::{ChatRequest, ChatResponse, ChatStream, TokenLedger, UserId};

/// Chat completion seam used by Qingxin modules.
#[async_trait]
pub trait Ai: Send + Sync {
    /// Return a full assistant message.
    async fn complete(&self, request: ChatRequest) -> Result<ChatResponse, AiError>;

    /// Stream assistant deltas, then a terminal [`crate::ChatChunk::End`].
    async fn stream(&self, request: ChatRequest) -> Result<ChatStream, AiError>;

    /// Read the in-memory token ledger for a user.
    async fn usage(&self, user_id: &UserId) -> TokenLedger;
}
