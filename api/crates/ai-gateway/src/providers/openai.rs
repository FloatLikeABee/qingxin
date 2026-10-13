//! Shared OpenAI-compatible `/chat/completions` adapter.

use std::fmt;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};

use crate::config::VendorConfig;
use crate::error::ProviderError;
use crate::provider::{Provider, ProviderDelta, ProviderRequest, ProviderResponse, ProviderStream};
use crate::secret::SecretString;
use crate::tokens::estimate_tokens;
use crate::types::{ProviderId, TokenUsage};

/// Inspectable HTTP request. `Debug` redacts the bearer token.
#[derive(Clone)]
pub struct BuiltHttpRequest {
    /// Full URL.
    pub url: String,
    /// Optional `Bearer` token (never printed).
    pub bearer: Option<SecretString>,
    /// JSON body.
    pub body: Value,
}

impl fmt::Debug for BuiltHttpRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("BuiltHttpRequest")
            .field("url", &self.url)
            .field("bearer", &self.bearer.as_ref().map(|_| "[redacted]"))
            .field("body", &self.body)
            .finish()
    }
}

/// DashScope, Zhipu, Kimi, and Ollama all speak this shape.
pub struct OpenAiCompat {
    id: ProviderId,
    base_url: String,
    api_key: Option<SecretString>,
    default_model: String,
    client: reqwest::Client,
}

impl OpenAiCompat {
    /// Ollama local default.
    pub fn ollama(config: VendorConfig) -> Self {
        Self::new(ProviderId::ollama(), config)
    }

    /// DashScope compatible-mode.
    pub fn dashscope(config: VendorConfig) -> Self {
        Self::new(ProviderId::dashscope(), config)
    }

    /// Zhipu GLM.
    pub fn zhipu(config: VendorConfig) -> Self {
        Self::new(ProviderId::zhipu(), config)
    }

    /// Moonshot / Kimi.
    pub fn kimi(config: VendorConfig) -> Self {
        Self::new(ProviderId::kimi(), config)
    }

    fn new(id: ProviderId, config: VendorConfig) -> Self {
        Self {
            id,
            base_url: config.base_url.trim_end_matches('/').to_string(),
            api_key: config.api_key,
            default_model: config.model,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// Build the request that `chat` would send. Used by tests; does not I/O.
    pub fn build_request(&self, request: &ProviderRequest) -> BuiltHttpRequest {
        let model = request
            .model
            .clone()
            .unwrap_or_else(|| self.default_model.clone());
        let messages: Vec<Value> = request
            .messages
            .iter()
            .map(|m| {
                json!({
                    "role": m.role.as_openai(),
                    "content": m.content,
                })
            })
            .collect();
        BuiltHttpRequest {
            url: format!("{}/chat/completions", self.base_url),
            bearer: self.api_key.clone(),
            body: json!({
                "model": model,
                "messages": messages,
            }),
        }
    }
}

#[async_trait]
impl Provider for OpenAiCompat {
    fn id(&self) -> &ProviderId {
        &self.id
    }

    async fn chat(&self, request: &ProviderRequest) -> Result<ProviderResponse, ProviderError> {
        let built = self.build_request(request);
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(key) = &built.bearer {
            if let Ok(value) = HeaderValue::from_str(&format!("Bearer {}", key.expose())) {
                headers.insert(AUTHORIZATION, value);
            }
        }
        let response = self
            .client
            .post(&built.url)
            .headers(headers)
            .json(&built.body)
            .send()
            .await
            .map_err(|err| ProviderError::Failed {
                message: sanitize_reqwest(err),
            })?;
        let status = response.status();
        let value: Value = response.json().await.map_err(|err| ProviderError::Failed {
            message: sanitize_reqwest(err),
        })?;
        if !status.is_success() {
            return Err(ProviderError::Failed {
                message: format!("http {status}"),
            });
        }
        let content = value
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let usage = parse_usage(&value).unwrap_or_else(|| TokenUsage {
            prompt_tokens: estimate_tokens(&request_text(request)),
            completion_tokens: estimate_tokens(&content),
        });
        Ok(ProviderResponse { content, usage })
    }

    async fn chat_stream(
        &self,
        request: &ProviderRequest,
    ) -> Result<ProviderStream, ProviderError> {
        // Streaming HTTP is a follow-up; callers get a one-shot replay of `chat`.
        let response = self.chat(request).await?;
        let events = vec![
            Ok(ProviderDelta::Text(response.content)),
            Ok(ProviderDelta::Usage(response.usage)),
        ];
        Ok(Box::pin(futures::stream::iter(events)))
    }
}

fn parse_usage(value: &Value) -> Option<TokenUsage> {
    let usage = value.get("usage")?;
    Some(TokenUsage {
        prompt_tokens: usage.get("prompt_tokens")?.as_u64()? as u32,
        completion_tokens: usage.get("completion_tokens")?.as_u64()? as u32,
    })
}

fn request_text(request: &ProviderRequest) -> String {
    request
        .messages
        .iter()
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n")
}

fn sanitize_reqwest(err: reqwest::Error) -> String {
    // reqwest Debug can include the full URL; drop query strings just in case.
    let raw = err.without_url().to_string();
    raw.split("key=")
        .next()
        .unwrap_or("http error")
        .trim()
        .to_string()
}
