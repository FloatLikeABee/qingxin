//! Pluggable embedding used by the semantic cache.

/// Turns a normalized conversation into a vector.
pub trait Embedder: Send + Sync {
    /// Dense embedding. Implementations SHOULD L2-normalize.
    fn embed(&self, text: &str) -> Vec<f32>;
}

/// Offline bag-of-words + character 3-grams. Deterministic, no network.
#[derive(Debug, Default, Clone)]
pub struct LexicalEmbedder;

impl LexicalEmbedder {
    /// Cosine similarity of two texts under the lexical embedder.
    pub fn cosine(a: &str, b: &str) -> f32 {
        lexical_cosine(a, b)
    }
}

impl Embedder for LexicalEmbedder {
    fn embed(&self, text: &str) -> Vec<f32> {
        lexical_vector(text)
    }
}

const DIM: usize = 256;

fn lexical_vector(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0_f32; DIM];
    let normalized = normalize_lex(text);
    for token in normalized.split(|c: char| c.is_whitespace() || c.is_ascii_punctuation()) {
        if token.is_empty() {
            continue;
        }
        bump(&mut vec, token);
    }
    let chars: Vec<char> = normalized.chars().collect();
    for n in 2..=4 {
        if chars.len() >= n {
            for window in chars.windows(n) {
                let gram: String = window.iter().collect();
                bump(&mut vec, &gram);
            }
        }
    }
    let norm = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for value in &mut vec {
            *value /= norm;
        }
    }
    vec
}

fn normalize_lex(text: &str) -> String {
    text.to_lowercase()
        .replace("ise", "ize")
        .replace("isation", "ization")
}

fn bump(vec: &mut [f32], token: &str) {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in token.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    let idx = (hash as usize) % vec.len();
    vec[idx] += 1.0;
}

fn lexical_cosine(a: &str, b: &str) -> f32 {
    let ea = lexical_vector(a);
    let eb = lexical_vector(b);
    let mut dot = 0.0;
    for (x, y) in ea.iter().zip(&eb) {
        dot += x * y;
    }
    dot
}

#[cfg(test)]
mod tests {
    use super::LexicalEmbedder;

    #[test]
    fn summarise_vs_summarize_is_semantic() {
        let a = "Summarise the meeting notes";
        let b = "Summarize the meeting notes";
        let c = "Write a poem about cats";
        assert!(
            LexicalEmbedder::cosine(a, b) >= 0.92,
            "near-duplicate cosine was {}",
            LexicalEmbedder::cosine(a, b)
        );
        assert!(
            LexicalEmbedder::cosine(a, c) < 0.92,
            "unrelated cosine was {}",
            LexicalEmbedder::cosine(a, c)
        );
    }
}
