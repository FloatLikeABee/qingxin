//! Public request and response types for the `Ai` seam.

use std::fmt;

/// Stable provider identifier (`ollama`, `dashscope`, `mock`, …).
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ProviderId(String);

impl ProviderId {
    /// Create a provider id from any string-like value.
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    /// Ollama (local default).
    pub fn ollama() -> Self {
        Self::new("ollama")
    }

    /// DashScope / Qwen compatible-mode.
    pub fn dashscope() -> Self {
        Self::new("dashscope")
    }

    /// Zhipu GLM.
    pub fn zhipu() -> Self {
        Self::new("zhipu")
    }

    /// Moonshot / Kimi.
    pub fn kimi() -> Self {
        Self::new("kimi")
    }

    /// Borrow the id string.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Per-user identifier used for rate limits and the token ledger.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct UserId(String);

impl UserId {
    /// Reject empty or whitespace-only ids.
    pub fn new(id: impl Into<String>) -> Result<Self, crate::AiError> {
        let id = id.into();
        if id.trim().is_empty() {
            return Err(crate::AiError::InvalidRequest {
                message: "user id must not be empty".into(),
            });
        }
        Ok(Self(id))
    }

    /// Borrow the user id.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Chat turn role.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    /// System prompt.
    System,
    /// End user.
    User,
    /// Assistant / model.
    Assistant,
}

impl Role {
    pub(crate) fn as_openai(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::User => "user",
            Self::Assistant => "assistant",
        }
    }
}

/// One chat message.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChatMessage {
    /// Who said it.
    pub role: Role,
    /// Message text.
    pub content: String,
}

/// A completion or stream request.
#[derive(Clone, Debug)]
pub struct ChatRequest {
    /// Caller identity for limits and accounting.
    pub user_id: UserId,
    /// Conversation so far. Must be non-empty at the seam.
    pub messages: Vec<ChatMessage>,
    /// Optional model override. Providers fall back to their default.
    pub model: Option<String>,
}

/// Prompt and completion tokens for one request.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct TokenUsage {
    /// Tokens in the prompt.
    pub prompt_tokens: u32,
    /// Tokens in the assistant reply.
    pub completion_tokens: u32,
}

impl TokenUsage {
    /// Sum of prompt and completion tokens.
    pub fn total(self) -> u32 {
        self.prompt_tokens.saturating_add(self.completion_tokens)
    }
}

/// Whether the answer came from a cache.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheStatus {
    /// Provider was called.
    Miss,
    /// Exact message+model hash hit.
    Exact,
    /// Semantic similarity hit.
    Semantic,
}

/// Successful complete result.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChatResponse {
    /// Request-scoped id.
    pub id: String,
    /// Full assistant text.
    pub content: String,
    /// Provider that produced or whose result was cached.
    pub provider: ProviderId,
    /// Tokens for this answer.
    pub usage: TokenUsage,
    /// Cache classification.
    pub cache: CacheStatus,
}

/// Accumulated usage for one user.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct TokenLedger {
    /// How many complete/stream attempts succeeded (including cache hits).
    pub request_count: u64,
    /// Sum of prompt tokens.
    pub prompt_tokens: u64,
    /// Sum of completion tokens.
    pub completion_tokens: u64,
}

impl TokenLedger {
    /// Sum of stored prompt and completion tokens.
    pub fn total_tokens(&self) -> u64 {
        self.prompt_tokens.saturating_add(self.completion_tokens)
    }
}

/// One frame of a streamed completion.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ChatChunk {
    /// Incremental assistant text.
    Delta {
        /// Token/text fragment.
        text: String,
    },
    /// Stream finished.
    End {
        /// Tokens for the full reply.
        usage: TokenUsage,
        /// Provider that served the stream (or cache).
        provider: ProviderId,
        /// Cache classification.
        cache: CacheStatus,
    },
}

/// Boxed stream returned by [`crate::Ai::stream`].
pub type ChatStream =
    std::pin::Pin<Box<dyn futures::Stream<Item = Result<ChatChunk, crate::AiError>> + Send>>;
