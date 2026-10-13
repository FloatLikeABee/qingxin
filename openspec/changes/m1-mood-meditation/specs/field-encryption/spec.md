# Spec Delta

## ADDED Requirements

### Requirement: AES-GCM for diary notes
The system SHALL persist mood-log notes as AES-256-GCM ciphertext (`nonce || ciphertext`) using T1 `FieldCrypto`. The `mood_logs.note_encrypted` column SHALL NOT store UTF-8 plaintext. A missing note SHALL store SQL NULL. List, get, insight, and export handlers SHALL decrypt only for the authenticated owner.

#### Scenario: Ciphertext is not plaintext
- **WHEN** a user creates a log with note `夜里醒了两次`
- **THEN** the database blob is non-empty and is not the UTF-8 bytes of that note, and the HTTP response still returns the plaintext note to the owner

#### Scenario: Empty note is null
- **WHEN** a user creates a log with no note
- **THEN** `note_encrypted` is NULL
