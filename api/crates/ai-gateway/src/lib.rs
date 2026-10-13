//! Qingxin (轻心) AI gateway library.
//!
//! Forge's API skeleton should depend on [`Ai`] and hold a [`Gateway`]
//! (or any other `Ai` impl) on application state.
//!
//! This crate is a library only. It does not bind a port.

#![deny(missing_docs)]

mod ai;
mod cache;
mod config;
mod embed;
mod error;
/// Types matching Forge's `AiGateway` seam (PR #5).
pub mod forge;
mod gateway;
mod provider;
mod providers;
mod rate_limit;
mod secret;
mod sse;
mod tokens;
mod types;

pub use ai::Ai;
pub use config::{GatewayConfig, VendorConfig};
pub use embed::LexicalEmbedder;
pub use error::{AiError, ProviderError};
pub use gateway::{Gateway, GatewayBuilder};
pub use provider::{Provider, ProviderDelta, ProviderRequest, ProviderResponse, ProviderStream};
pub use providers::{BuiltHttpRequest, MockProvider, OpenAiCompat};
pub use secret::SecretString;
pub use sse::encode_sse;
pub use types::{
    CacheStatus, ChatChunk, ChatMessage, ChatRequest, ChatResponse, ChatStream, ProviderId, Role,
    TokenLedger, TokenUsage, UserId,
};
