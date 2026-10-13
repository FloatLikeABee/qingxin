//! In-memory exact and semantic prompt cache.

use sha2::{Digest, Sha256};

use crate::embed::Embedder;
use crate::types::{CacheStatus, ChatMessage, ChatResponse, ProviderId, TokenUsage};

#[derive(Clone)]
pub(crate) struct CachedCompletion {
    pub content: String,
    pub provider: ProviderId,
    pub usage: TokenUsage,
}

pub(crate) struct PromptCache {
    exact: Vec<(String, CachedCompletion)>,
    semantic: Vec<(Vec<f32>, String, CachedCompletion)>,
    threshold: f32,
}

impl PromptCache {
    pub(crate) fn new(threshold: f32) -> Self {
        Self {
            exact: Vec::new(),
            semantic: Vec::new(),
            threshold,
        }
    }

    pub(crate) fn lookup(
        &self,
        model: Option<&str>,
        messages: &[ChatMessage],
        embedder: &dyn Embedder,
    ) -> Option<(CacheStatus, CachedCompletion)> {
        let key = exact_key(model, messages);
        if let Some((_, hit)) = self.exact.iter().find(|(k, _)| k == &key) {
            return Some((CacheStatus::Exact, hit.clone()));
        }
        let query = embedder.embed(&conversation_text(model, messages));
        let mut best: Option<(f32, &CachedCompletion)> = None;
        for (vector, _, completion) in &self.semantic {
            let score = cosine(&query, vector);
            if score >= self.threshold && best.as_ref().map(|(s, _)| score > *s).unwrap_or(true) {
                best = Some((score, completion));
            }
        }
        best.map(|(_, hit)| (CacheStatus::Semantic, hit.clone()))
    }

    pub(crate) fn store(
        &mut self,
        model: Option<&str>,
        messages: &[ChatMessage],
        completion: CachedCompletion,
        embedder: &dyn Embedder,
    ) {
        let key = exact_key(model, messages);
        let vector = embedder.embed(&conversation_text(model, messages));
        if let Some((_, existing)) = self.exact.iter_mut().find(|(k, _)| k == &key) {
            *existing = completion.clone();
        } else {
            self.exact.push((key.clone(), completion.clone()));
        }
        self.semantic.push((vector, key, completion));
    }
}

fn exact_key(model: Option<&str>, messages: &[ChatMessage]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(model.unwrap_or("").as_bytes());
    hasher.update([0xff]);
    for message in messages {
        hasher.update(message.role.as_openai().as_bytes());
        hasher.update([0xfe]);
        hasher.update(message.content.trim().as_bytes());
        hasher.update([0xfd]);
    }
    hex::encode(hasher.finalize())
}

fn conversation_text(model: Option<&str>, messages: &[ChatMessage]) -> String {
    let mut out = String::new();
    if let Some(model) = model {
        out.push_str(model);
        out.push('\n');
    }
    for message in messages {
        out.push_str(message.role.as_openai());
        out.push(':');
        out.push_str(message.content.trim());
        out.push('\n');
    }
    out
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0;
    let mut na = 0.0;
    let mut nb = 0.0;
    for (x, y) in a.iter().zip(b) {
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

impl From<(CacheStatus, CachedCompletion)> for ChatResponse {
    fn from((cache, hit): (CacheStatus, CachedCompletion)) -> Self {
        ChatResponse {
            id: String::new(),
            content: hit.content,
            provider: hit.provider,
            usage: hit.usage,
            cache,
        }
    }
}
