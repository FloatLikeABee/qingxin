//! Per-user sliding-window rate limiter.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::error::AiError;
use crate::types::UserId;

/// Clock so tests can inject time if needed.
pub trait Clock: Send + Sync {
    /// Current instant.
    fn now(&self) -> Instant;
}

/// `Instant::now`.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }
}

pub(crate) struct RateLimiter {
    max: u32,
    window: Duration,
    clock: Box<dyn Clock>,
    hits: HashMap<String, Vec<Instant>>,
}

impl RateLimiter {
    pub(crate) fn new(max: u32, window: Duration) -> Self {
        Self {
            max,
            window,
            clock: Box::new(SystemClock),
            hits: HashMap::new(),
        }
    }

    pub(crate) fn try_acquire(&mut self, user_id: &UserId) -> Result<(), AiError> {
        if self.max == 0 {
            return Err(AiError::RateLimited {
                user_id: user_id.clone(),
                retry_after: self.window,
            });
        }
        let now = self.clock.now();
        let cutoff = now.checked_sub(self.window).unwrap_or(now);
        let bucket = self.hits.entry(user_id.as_str().to_string()).or_default();
        bucket.retain(|t| *t > cutoff);
        if bucket.len() as u32 >= self.max {
            let oldest = bucket.first().copied().unwrap_or(now);
            let retry_after = self
                .window
                .saturating_sub(now.saturating_duration_since(oldest));
            return Err(AiError::RateLimited {
                user_id: user_id.clone(),
                retry_after,
            });
        }
        bucket.push(now);
        Ok(())
    }
}
