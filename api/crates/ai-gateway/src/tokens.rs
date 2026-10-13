//! In-memory per-user token ledger.

use std::collections::HashMap;

use crate::types::{TokenLedger, TokenUsage, UserId};

pub(crate) struct TokenStore {
    users: HashMap<String, TokenLedger>,
}

impl TokenStore {
    pub(crate) fn new() -> Self {
        Self {
            users: HashMap::new(),
        }
    }

    pub(crate) fn record(&mut self, user_id: &UserId, usage: TokenUsage) {
        let entry = self.users.entry(user_id.as_str().to_string()).or_default();
        entry.request_count = entry.request_count.saturating_add(1);
        entry.prompt_tokens = entry
            .prompt_tokens
            .saturating_add(u64::from(usage.prompt_tokens));
        entry.completion_tokens = entry
            .completion_tokens
            .saturating_add(u64::from(usage.completion_tokens));
    }

    pub(crate) fn get(&self, user_id: &UserId) -> TokenLedger {
        self.users
            .get(user_id.as_str())
            .cloned()
            .unwrap_or_default()
    }
}

/// Estimate tokens when a vendor omits `usage`.
pub(crate) fn estimate_tokens(text: &str) -> u32 {
    let mut tokens = 0_u32;
    let mut ascii_word = false;
    for ch in text.chars() {
        if ch.is_ascii_whitespace() {
            ascii_word = false;
            continue;
        }
        if is_cjk(ch) {
            tokens = tokens.saturating_add(1);
            ascii_word = false;
        } else if ch.is_ascii_alphanumeric() {
            if !ascii_word {
                tokens = tokens.saturating_add(1);
                ascii_word = true;
            }
        } else {
            ascii_word = false;
        }
    }
    tokens.max(1)
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch,
        '\u{4E00}'..='\u{9FFF}'
            | '\u{3400}'..='\u{4DBF}'
            | '\u{3040}'..='\u{30FF}'
            | '\u{AC00}'..='\u{D7AF}'
    )
}
