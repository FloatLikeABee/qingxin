use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Reject { reason: String },
}

#[derive(Debug, thiserror::Error)]
pub enum ModerationError {
    #[error("{0}")]
    Failed(String),
}

#[async_trait]
pub trait Moderator: Send + Sync {
    async fn check(&self, content: &str) -> Result<Decision, ModerationError>;
}

pub struct NoopModerator;

#[async_trait]
impl Moderator for NoopModerator {
    async fn check(&self, _content: &str) -> Result<Decision, ModerationError> {
        Ok(Decision::Allow)
    }
}
