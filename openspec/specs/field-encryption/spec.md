# field-encryption Specification

## Purpose
Keeps phone numbers unreadable at rest while still allowing login-by-phone lookup and a lawful export of the caller's own number.

## Requirements

### Requirement: AES-GCM for phone numbers
The system SHALL persist phone numbers as AES-256-GCM ciphertext with a random nonce and SHALL store a separate HMAC-SHA256 lookup hash of the normalized number. The database row SHALL NOT contain the plaintext phone. The process SHALL refuse to start if the data key or lookup key is missing or not 32 bytes.

#### Scenario: Ciphertext is not plaintext
- **WHEN** a user registers or verifies a phone
- **THEN** the users table stores a non-empty `phone_encrypted` blob that is not the UTF-8 plaintext of the number

#### Scenario: Lookup still works
- **WHEN** the same phone requests a second SMS code
- **THEN** the system finds the existing user via the lookup hash without decrypting every row

### Requirement: Export decrypts for the owner
A successful privacy export SHALL include the caller's phone in plaintext in the JSON body and SHALL NOT write that plaintext back to the database.

#### Scenario: Export shows the phone
- **WHEN** a phone-verified user calls `GET /v1/privacy/export`
- **THEN** the payload `user.phone` equals the number they verified

### Requirement: AES-GCM for diary notes
The system SHALL persist mood-log notes as AES-256-GCM ciphertext (`nonce || ciphertext`) using T1 `FieldCrypto`. The `mood_logs.note_encrypted` column SHALL NOT store UTF-8 plaintext. A missing note SHALL store SQL NULL. List, get, insight, and export handlers SHALL decrypt only for the authenticated owner.

#### Scenario: Ciphertext is not plaintext
- **WHEN** a user creates a log with note `夜里醒了两次`
- **THEN** the database blob is non-empty and is not the UTF-8 bytes of that note, and the HTTP response still returns the plaintext note to the owner

#### Scenario: Empty note is null
- **WHEN** a user creates a log with no note
- **THEN** `note_encrypted` is NULL
