//! Secret wrapper that never prints the raw value.

use std::fmt;

/// API key or other credential. `Debug`/`Display` always print `[redacted]`.
#[derive(Clone)]
pub struct SecretString(String);

impl SecretString {
    /// Wrap a raw secret.
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// True when the secret is empty or whitespace.
    pub fn is_empty(&self) -> bool {
        self.0.trim().is_empty()
    }

    /// Borrow the raw secret. Callers must not log this.
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[redacted]")
    }
}

impl fmt::Display for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[redacted]")
    }
}

#[cfg(test)]
mod tests {
    use super::SecretString;

    #[test]
    fn debug_hides_value() {
        let secret = SecretString::new("sk-secret-test");
        assert!(!format!("{secret:?}").contains("sk-secret-test"));
        assert!(!format!("{secret}").contains("sk-secret-test"));
    }
}
