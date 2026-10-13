//! Gateway and provider errors.

use std::fmt;
use std::time::Duration;

use crate::types::{ProviderId, UserId};

/// Recoverable failure from the [`crate::Ai`] seam.
#[derive(Debug)]
pub enum AiError {
    /// The caller sent an empty user id or no messages.
    InvalidRequest {
        /// Human-readable reason (never a secret).
        message: String,
    },
    /// The user exceeded the configured request window.
    RateLimited {
        /// User who is limited.
        user_id: UserId,
        /// Hint for when a slot frees.
        retry_after: Duration,
    },
    /// Every configured provider errored or timed out.
    AllProvidersFailed {
        /// Provider id plus a sanitized error message.
        errors: Vec<(ProviderId, String)>,
    },
}

impl fmt::Display for AiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRequest { message } => write!(f, "invalid request: {message}"),
            Self::RateLimited { user_id, .. } => {
                write!(f, "rate limited user {}", user_id.as_str())
            }
            Self::AllProvidersFailed { errors } => {
                write!(f, "all providers failed ({} attempt(s))", errors.len())
            }
        }
    }
}

impl std::error::Error for AiError {}

/// Failure from a single provider attempt.
#[derive(Debug)]
pub enum ProviderError {
    /// The vendor or mock returned an error status or scripted failure.
    Failed {
        /// Sanitized message. Must not contain API keys.
        message: String,
    },
    /// The attempt exceeded the per-provider timeout.
    Timeout,
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Failed { message } => write!(f, "{message}"),
            Self::Timeout => write!(f, "timeout"),
        }
    }
}

impl std::error::Error for ProviderError {}
