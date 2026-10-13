//! Environment / explicit configuration. Keys never have hardcoded defaults.

use std::fmt;
use std::time::Duration;

use crate::secret::SecretString;
use crate::types::ProviderId;

/// One OpenAI-compatible vendor endpoint.
#[derive(Clone)]
pub struct VendorConfig {
    /// Base URL without a trailing slash, e.g. `https://host/v1`.
    pub base_url: String,
    /// Bearer token. Ollama may omit this.
    pub api_key: Option<SecretString>,
    /// Default model name when the request does not override it.
    pub model: String,
}

impl fmt::Debug for VendorConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("VendorConfig")
            .field("base_url", &self.base_url)
            .field("api_key", &self.api_key.as_ref().map(|_| "[redacted]"))
            .field("model", &self.model)
            .finish()
    }
}

/// Gateway configuration loaded from env or an explicit map.
#[derive(Clone, Debug)]
pub struct GatewayConfig {
    /// Per-attempt timeout. Default 30s.
    pub timeout: Duration,
    /// Requests allowed per user per window. Default 30.
    pub rate_max: u32,
    /// Rate-limit window. Default 60s.
    pub rate_window: Duration,
    /// Semantic cache cosine threshold. Default 0.92.
    pub semantic_threshold: f32,
    /// Local Ollama (always present; no key required).
    pub ollama: VendorConfig,
    /// DashScope compatible-mode, if a key is set.
    pub dashscope: Option<VendorConfig>,
    /// Zhipu, if a key is set.
    pub zhipu: Option<VendorConfig>,
    /// Kimi / Moonshot, if a key is set.
    pub kimi: Option<VendorConfig>,
}

impl GatewayConfig {
    /// Read process environment.
    pub fn from_env() -> Self {
        Self::from_vars(|key| std::env::var(key).ok())
    }

    /// Read from a getter (tests inject a map).
    pub fn from_vars(get: impl Fn(&str) -> Option<String>) -> Self {
        let timeout_ms = parse_u64(get("QINGXIN_AI_TIMEOUT_MS"), 30_000);
        let rate_max = parse_u64(get("QINGXIN_AI_RATE_LIMIT_RPM"), 30) as u32;
        let threshold = get("QINGXIN_AI_SEMANTIC_THRESHOLD")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.92);
        Self {
            timeout: Duration::from_millis(timeout_ms),
            rate_max: rate_max.max(1),
            rate_window: Duration::from_secs(60),
            semantic_threshold: threshold,
            ollama: VendorConfig {
                base_url: get("OLLAMA_BASE_URL")
                    .unwrap_or_else(|| "http://127.0.0.1:11434/v1".into()),
                api_key: optional_secret(get("OLLAMA_API_KEY")),
                model: get("OLLAMA_MODEL").unwrap_or_else(|| "qwen2.5".into()),
            },
            dashscope: vendor(
                get("DASHSCOPE_API_KEY"),
                get("DASHSCOPE_BASE_URL")
                    .unwrap_or_else(|| "https://dashscope.aliyuncs.com/compatible-mode/v1".into()),
                get("DASHSCOPE_MODEL").unwrap_or_else(|| "qwen-plus".into()),
            ),
            zhipu: vendor(
                get("ZHIPU_API_KEY").or_else(|| get("ZHIPUAI_API_KEY")),
                get("ZHIPU_BASE_URL")
                    .unwrap_or_else(|| "https://open.bigmodel.cn/api/paas/v4".into()),
                get("ZHIPU_MODEL").unwrap_or_else(|| "glm-4-flash".into()),
            ),
            kimi: vendor(
                get("MOONSHOT_API_KEY").or_else(|| get("KIMI_API_KEY")),
                get("KIMI_BASE_URL").unwrap_or_else(|| "https://api.moonshot.cn/v1".into()),
                get("KIMI_MODEL").unwrap_or_else(|| "moonshot-v1-8k".into()),
            ),
        }
    }

    /// Fallback chain ids. Ollama is always first.
    pub fn provider_ids(&self) -> Vec<ProviderId> {
        let mut ids = vec![ProviderId::ollama()];
        if self.dashscope.is_some() {
            ids.push(ProviderId::dashscope());
        }
        if self.zhipu.is_some() {
            ids.push(ProviderId::zhipu());
        }
        if self.kimi.is_some() {
            ids.push(ProviderId::kimi());
        }
        ids
    }
}

fn optional_secret(value: Option<String>) -> Option<SecretString> {
    value.and_then(|v| {
        if v.trim().is_empty() {
            None
        } else {
            Some(SecretString::new(v))
        }
    })
}

fn vendor(key: Option<String>, base_url: String, model: String) -> Option<VendorConfig> {
    let api_key = optional_secret(key)?;
    Some(VendorConfig {
        base_url,
        api_key: Some(api_key),
        model,
    })
}

fn parse_u64(raw: Option<String>, default: u64) -> u64 {
    raw.and_then(|s| s.parse().ok()).unwrap_or(default)
}
