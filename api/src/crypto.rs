use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::error::AppError;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct FieldCrypto {
    data_key: [u8; 32],
    lookup_key: [u8; 32],
}

impl FieldCrypto {
    pub fn new(data_key: [u8; 32], lookup_key: [u8; 32]) -> Self {
        Self {
            data_key,
            lookup_key,
        }
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>, AppError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.data_key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|_| AppError::Unavailable("encrypt failed".into()))?;
        let mut out = Vec::with_capacity(nonce.len() + ciphertext.len());
        out.extend_from_slice(nonce.as_slice());
        out.extend(ciphertext);
        Ok(out)
    }

    pub fn decrypt(&self, blob: &[u8]) -> Result<Vec<u8>, AppError> {
        if blob.len() < 12 {
            return Err(AppError::Unavailable("ciphertext too short".into()));
        }
        let (nonce_bytes, ciphertext) = blob.split_at(12);
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.data_key));
        let nonce = Nonce::from_slice(nonce_bytes);
        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| AppError::Unavailable("decrypt failed".into()))
    }

    pub fn lookup_hash(&self, normalized: &str) -> String {
        let mut mac = <HmacSha256 as Mac>::new_from_slice(&self.lookup_key)
            .expect("HMAC-SHA256 accepts a 32-byte key");
        mac.update(normalized.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::FieldCrypto;

    #[test]
    fn aes_gcm_round_trip_and_lookup_are_not_plaintext() {
        let crypto = FieldCrypto::new([3u8; 32], [5u8; 32]);
        let phone = b"+8613800138000";
        let blob = crypto.encrypt(phone).unwrap();
        assert_ne!(blob, phone);
        assert_eq!(crypto.decrypt(&blob).unwrap(), phone);
        let lookup = crypto.lookup_hash("+8613800138000");
        assert_ne!(lookup, "+8613800138000");
        assert_eq!(lookup, crypto.lookup_hash("+8613800138000"));
    }
}
