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

### Requirement: AES-GCM for transaction notes
The system SHALL persist finance transaction notes as AES-256-GCM ciphertext using T1 `FieldCrypto`. Amounts MUST remain plaintext integer fen. The database row MUST NOT contain the UTF-8 plaintext of a non-empty note.

#### Scenario: Note ciphertext is not plaintext
- **WHEN** a user creates a transaction with note 午饭
- **THEN** the fin_transactions row stores a non-empty note_encrypted blob that is not the UTF-8 bytes of 午饭
- **AND** a later GET of that transaction returns note 午饭

#### Scenario: Amounts stay aggregatable
- **WHEN** two expenses of 1000 and 2000 fen exist in the same month
- **THEN** the monthly summary expense total is 3000 fen computed from plaintext amount_fen
