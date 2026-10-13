//! OpenAI-compatible `text/event-stream` framing.

use serde_json::json;

use crate::types::ChatChunk;

/// Encode one gateway chunk as an SSE frame (including the trailing blank line).
pub fn encode_sse(chunk: &ChatChunk) -> String {
    match chunk {
        ChatChunk::Delta { text } => {
            let payload = json!({
                "object": "chat.completion.chunk",
                "choices": [{
                    "index": 0,
                    "delta": { "content": text }
                }]
            });
            format!("data: {payload}\n\n")
        }
        ChatChunk::End { .. } => "data: [DONE]\n\n".to_string(),
    }
}
