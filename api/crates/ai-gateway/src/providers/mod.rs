//! Vendor adapters and the mock provider.

mod mock;
mod openai;

pub use mock::MockProvider;
pub use openai::{BuiltHttpRequest, OpenAiCompat};
