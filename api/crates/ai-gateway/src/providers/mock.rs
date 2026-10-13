//! In-process provider. No sockets, no keys.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use futures::stream;

use crate::error::ProviderError;
use crate::provider::{Provider, ProviderDelta, ProviderRequest, ProviderResponse, ProviderStream};
use crate::types::{ProviderId, TokenUsage};

#[derive(Clone)]
enum Script {
    Text {
        content: String,
        usage: TokenUsage,
        delay: Duration,
        deltas: Option<Vec<String>>,
    },
    Error {
        message: String,
    },
}

/// Scriptable provider for tests.
#[derive(Clone)]
pub struct MockProvider {
    id: ProviderId,
    script: Arc<Script>,
    calls: Arc<AtomicUsize>,
}

impl MockProvider {
    /// Named mock; default script is an empty success (overridden by builders).
    pub fn named(id: impl Into<String>) -> Self {
        Self {
            id: ProviderId::new(id),
            script: Arc::new(Script::Text {
                content: String::new(),
                usage: TokenUsage::default(),
                delay: Duration::ZERO,
                deltas: None,
            }),
            calls: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Succeed with this assistant text.
    pub fn text(mut self, content: impl Into<String>) -> Self {
        let content = content.into();
        self.script = Arc::new(match self.script.as_ref().clone() {
            Script::Text {
                usage,
                delay,
                deltas,
                ..
            } => Script::Text {
                content,
                usage,
                delay,
                deltas,
            },
            Script::Error { .. } => Script::Text {
                content,
                usage: TokenUsage::default(),
                delay: Duration::ZERO,
                deltas: None,
            },
        });
        self
    }

    /// Script prompt/completion token counts.
    pub fn usage(mut self, prompt_tokens: u32, completion_tokens: u32) -> Self {
        if let Script::Text {
            content,
            delay,
            deltas,
            ..
        } = self.script.as_ref().clone()
        {
            self.script = Arc::new(Script::Text {
                content,
                usage: TokenUsage {
                    prompt_tokens,
                    completion_tokens,
                },
                delay,
                deltas,
            });
        }
        self
    }

    /// Sleep before returning (used to trip the gateway timeout).
    pub fn delay(mut self, delay: Duration) -> Self {
        if let Script::Text {
            content,
            usage,
            deltas,
            ..
        } = self.script.as_ref().clone()
        {
            self.script = Arc::new(Script::Text {
                content,
                usage,
                delay,
                deltas,
            });
        }
        self
    }

    /// Stream these fragments instead of a single blob.
    pub fn deltas<I, S>(mut self, parts: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let deltas: Vec<String> = parts.into_iter().map(Into::into).collect();
        let joined = deltas.concat();
        if let Script::Text {
            usage,
            delay,
            content,
            ..
        } = self.script.as_ref().clone()
        {
            let content = if content.is_empty() { joined } else { content };
            self.script = Arc::new(Script::Text {
                content,
                usage,
                delay,
                deltas: Some(deltas),
            });
        }
        self
    }

    /// Always fail this provider.
    pub fn error(mut self, message: impl Into<String>) -> Self {
        self.script = Arc::new(Script::Error {
            message: message.into(),
        });
        self
    }

    /// How many times `chat` or `chat_stream` was entered.
    pub fn call_count(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }

    async fn run(&self) -> Result<ProviderResponse, ProviderError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        match self.script.as_ref() {
            Script::Error { message } => Err(ProviderError::Failed {
                message: message.clone(),
            }),
            Script::Text {
                content,
                usage,
                delay,
                ..
            } => {
                if !delay.is_zero() {
                    tokio::time::sleep(*delay).await;
                }
                Ok(ProviderResponse {
                    content: content.clone(),
                    usage: *usage,
                })
            }
        }
    }
}

#[async_trait]
impl Provider for MockProvider {
    fn id(&self) -> &ProviderId {
        &self.id
    }

    async fn chat(&self, _request: &ProviderRequest) -> Result<ProviderResponse, ProviderError> {
        self.run().await
    }

    async fn chat_stream(
        &self,
        _request: &ProviderRequest,
    ) -> Result<ProviderStream, ProviderError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        match self.script.as_ref() {
            Script::Error { message } => Err(ProviderError::Failed {
                message: message.clone(),
            }),
            Script::Text {
                content,
                usage,
                delay,
                deltas,
            } => {
                if !delay.is_zero() {
                    tokio::time::sleep(*delay).await;
                }
                let mut events = Vec::new();
                if let Some(parts) = deltas {
                    for part in parts {
                        events.push(Ok(ProviderDelta::Text(part.clone())));
                    }
                } else if !content.is_empty() {
                    events.push(Ok(ProviderDelta::Text(content.clone())));
                }
                events.push(Ok(ProviderDelta::Usage(*usage)));
                Ok(Box::pin(stream::iter(events)))
            }
        }
    }
}

impl Script {
    fn clone(&self) -> Self {
        match self {
            Script::Text {
                content,
                usage,
                delay,
                deltas,
            } => Script::Text {
                content: content.clone(),
                usage: *usage,
                delay: *delay,
                deltas: deltas.clone(),
            },
            Script::Error { message } => Script::Error {
                message: message.clone(),
            },
        }
    }
}
