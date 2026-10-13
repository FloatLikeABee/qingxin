//! [`Gateway`] implements [`crate::Ai`] over a provider chain.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::Mutex;

use crate::ai::Ai;
use crate::cache::{CachedCompletion, PromptCache};
use crate::config::GatewayConfig;
use crate::embed::{Embedder, LexicalEmbedder};
use crate::error::{AiError, ProviderError};
use crate::provider::ProviderDelta;
use crate::provider::{Provider, ProviderRequest};
use crate::providers::OpenAiCompat;
use crate::rate_limit::RateLimiter;
use crate::tokens::estimate_tokens;
use crate::tokens::TokenStore;
use crate::types::{
    CacheStatus, ChatChunk, ChatRequest, ChatResponse, ChatStream, TokenLedger, TokenUsage, UserId,
};
use futures::channel::mpsc;
use futures::StreamExt;

/// Builds a [`Gateway`] for tests or custom wiring.
pub struct GatewayBuilder {
    providers: Vec<Arc<dyn Provider>>,
    timeout: Duration,
    semantic_threshold: f32,
    embedder: Arc<dyn Embedder>,
    rate_max: u32,
    rate_window: Duration,
}

impl GatewayBuilder {
    /// Empty chain. Add at least one provider before [`Self::build`].
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
            timeout: Duration::from_secs(30),
            semantic_threshold: 0.92,
            embedder: Arc::new(LexicalEmbedder),
            rate_max: u32::MAX,
            rate_window: Duration::from_secs(60),
        }
    }

    /// Append a provider to the fallback chain.
    pub fn provider(mut self, provider: impl Provider + 'static) -> Self {
        self.providers.push(Arc::new(provider));
        self
    }

    /// Per-attempt timeout. Default 30s.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Cosine threshold for the semantic cache. Default 0.92.
    pub fn semantic_threshold(mut self, threshold: f32) -> Self {
        self.semantic_threshold = threshold;
        self
    }

    /// Per-user sliding window. Tests typically use a small `max`.
    pub fn rate_limit(mut self, max: u32, window: Duration) -> Self {
        self.rate_max = max;
        self.rate_window = window;
        self
    }

    /// Finish the builder.
    pub fn build(self) -> Gateway {
        Gateway {
            providers: self.providers,
            timeout: self.timeout,
            ids: AtomicU64::new(1),
            cache: Arc::new(Mutex::new(PromptCache::new(self.semantic_threshold))),
            embedder: self.embedder,
            limiter: Arc::new(Mutex::new(RateLimiter::new(
                self.rate_max,
                self.rate_window,
            ))),
            ledger: Arc::new(Mutex::new(TokenStore::new())),
        }
    }
}

impl Default for GatewayBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// In-process AI gateway.
pub struct Gateway {
    providers: Vec<Arc<dyn Provider>>,
    timeout: Duration,
    ids: AtomicU64,
    cache: Arc<Mutex<PromptCache>>,
    embedder: Arc<dyn Embedder>,
    limiter: Arc<Mutex<RateLimiter>>,
    ledger: Arc<Mutex<TokenStore>>,
}

impl Gateway {
    /// Start a custom chain (typically mocks in tests).
    pub fn builder() -> GatewayBuilder {
        GatewayBuilder::new()
    }

    /// Build HTTP adapters from config. Never inserts the mock provider.
    pub fn from_config(config: GatewayConfig) -> Self {
        let mut builder = Self::builder()
            .timeout(config.timeout)
            .rate_limit(config.rate_max, config.rate_window)
            .semantic_threshold(config.semantic_threshold)
            .provider(OpenAiCompat::ollama(config.ollama.clone()));
        if let Some(vendor) = config.dashscope.clone() {
            builder = builder.provider(OpenAiCompat::dashscope(vendor));
        }
        if let Some(vendor) = config.zhipu.clone() {
            builder = builder.provider(OpenAiCompat::zhipu(vendor));
        }
        if let Some(vendor) = config.kimi.clone() {
            builder = builder.provider(OpenAiCompat::kimi(vendor));
        }
        builder.build()
    }

    /// `from_config(GatewayConfig::from_env())`.
    pub fn from_env() -> Self {
        Self::from_config(GatewayConfig::from_env())
    }

    /// Provider ids in fallback order (tests / hookup docs).
    pub fn provider_ids(&self) -> Vec<crate::types::ProviderId> {
        self.providers.iter().map(|p| p.id().clone()).collect()
    }

    fn validate(request: &ChatRequest) -> Result<(), AiError> {
        if request.user_id.as_str().trim().is_empty() {
            return Err(AiError::InvalidRequest {
                message: "user id must not be empty".into(),
            });
        }
        if request.messages.is_empty() {
            return Err(AiError::InvalidRequest {
                message: "messages must not be empty".into(),
            });
        }
        Ok(())
    }

    fn next_id(&self) -> String {
        format!("chat-{}", self.ids.fetch_add(1, Ordering::Relaxed))
    }
}

#[async_trait]
impl Ai for Gateway {
    async fn complete(&self, request: ChatRequest) -> Result<ChatResponse, AiError> {
        Self::validate(&request)?;
        self.limiter.lock().await.try_acquire(&request.user_id)?;
        if self.providers.is_empty() {
            return Err(AiError::InvalidRequest {
                message: "no providers configured".into(),
            });
        }
        {
            let cache = self.cache.lock().await;
            if let Some((status, hit)) = cache.lookup(
                request.model.as_deref(),
                &request.messages,
                self.embedder.as_ref(),
            ) {
                self.ledger.lock().await.record(&request.user_id, hit.usage);
                return Ok(ChatResponse {
                    id: self.next_id(),
                    content: hit.content,
                    provider: hit.provider,
                    usage: hit.usage,
                    cache: status,
                });
            }
        }
        let req = ProviderRequest {
            messages: request.messages.clone(),
            model: request.model.clone(),
        };
        let mut errors = Vec::new();
        for provider in &self.providers {
            match tokio::time::timeout(self.timeout, provider.chat(&req)).await {
                Ok(Ok(response)) => {
                    let stored = CachedCompletion {
                        content: response.content.clone(),
                        provider: provider.id().clone(),
                        usage: response.usage,
                    };
                    self.cache.lock().await.store(
                        request.model.as_deref(),
                        &request.messages,
                        stored,
                        self.embedder.as_ref(),
                    );
                    self.ledger
                        .lock()
                        .await
                        .record(&request.user_id, response.usage);
                    return Ok(ChatResponse {
                        id: self.next_id(),
                        content: response.content,
                        provider: provider.id().clone(),
                        usage: response.usage,
                        cache: CacheStatus::Miss,
                    });
                }
                Ok(Err(ProviderError::Failed { message })) => {
                    errors.push((provider.id().clone(), message));
                }
                Ok(Err(ProviderError::Timeout)) | Err(_) => {
                    errors.push((provider.id().clone(), "timeout".into()));
                }
            }
        }
        Err(AiError::AllProvidersFailed { errors })
    }

    async fn stream(&self, request: ChatRequest) -> Result<ChatStream, AiError> {
        Self::validate(&request)?;
        self.limiter.lock().await.try_acquire(&request.user_id)?;
        if self.providers.is_empty() {
            return Err(AiError::InvalidRequest {
                message: "no providers configured".into(),
            });
        }
        {
            let cache = self.cache.lock().await;
            if let Some((status, hit)) = cache.lookup(
                request.model.as_deref(),
                &request.messages,
                self.embedder.as_ref(),
            ) {
                self.ledger.lock().await.record(&request.user_id, hit.usage);
                let chunks = vec![
                    Ok(ChatChunk::Delta { text: hit.content }),
                    Ok(ChatChunk::End {
                        usage: hit.usage,
                        provider: hit.provider,
                        cache: status,
                    }),
                ];
                return Ok(Box::pin(futures::stream::iter(chunks)));
            }
        }

        let req = ProviderRequest {
            messages: request.messages.clone(),
            model: request.model.clone(),
        };
        let mut errors = Vec::new();
        for provider in &self.providers {
            match tokio::time::timeout(self.timeout, provider.chat_stream(&req)).await {
                Ok(Ok(pstream)) => {
                    return Ok(self.forward_stream(request, provider.id().clone(), pstream));
                }
                Ok(Err(ProviderError::Failed { message })) => {
                    errors.push((provider.id().clone(), message));
                }
                Ok(Err(ProviderError::Timeout)) | Err(_) => {
                    errors.push((provider.id().clone(), "timeout".into()));
                }
            }
        }
        Err(AiError::AllProvidersFailed { errors })
    }

    async fn usage(&self, user_id: &UserId) -> TokenLedger {
        self.ledger.lock().await.get(user_id)
    }
}

impl Gateway {
    fn forward_stream(
        &self,
        request: ChatRequest,
        provider: crate::types::ProviderId,
        mut pstream: crate::provider::ProviderStream,
    ) -> ChatStream {
        let cache = Arc::clone(&self.cache);
        let embedder = Arc::clone(&self.embedder);
        let ledger = Arc::clone(&self.ledger);
        let (tx, rx) = mpsc::unbounded();
        tokio::spawn(async move {
            let mut collected = String::new();
            let mut usage = TokenUsage::default();
            while let Some(item) = pstream.next().await {
                match item {
                    Ok(ProviderDelta::Text(text)) => {
                        collected.push_str(&text);
                        if tx.unbounded_send(Ok(ChatChunk::Delta { text })).is_err() {
                            return;
                        }
                    }
                    Ok(ProviderDelta::Usage(next)) => usage = next,
                    Err(err) => {
                        let message = match err {
                            ProviderError::Failed { message } => message,
                            ProviderError::Timeout => "timeout".into(),
                        };
                        let _ = tx.unbounded_send(Err(AiError::AllProvidersFailed {
                            errors: vec![(provider, message)],
                        }));
                        return;
                    }
                }
            }
            if usage.total() == 0 {
                usage.completion_tokens = estimate_tokens(&collected);
            }
            cache.lock().await.store(
                request.model.as_deref(),
                &request.messages,
                CachedCompletion {
                    content: collected,
                    provider: provider.clone(),
                    usage,
                },
                embedder.as_ref(),
            );
            ledger.lock().await.record(&request.user_id, usage);
            let _ = tx.unbounded_send(Ok(ChatChunk::End {
                usage,
                provider,
                cache: CacheStatus::Miss,
            }));
        });
        Box::pin(rx)
    }
}
