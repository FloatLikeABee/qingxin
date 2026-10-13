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

### Requirement: AES-GCM for diary notes
The system SHALL persist mood-log notes as AES-256-GCM ciphertext (`nonce || ciphertext`) using T1 `FieldCrypto`. The `mood_logs.note_encrypted` column SHALL NOT store UTF-8 plaintext. A missing note SHALL store SQL NULL. List, get, insight, and export handlers SHALL decrypt only for the authenticated owner.

#### Scenario: Ciphertext is not plaintext
- **WHEN** a user creates a log with note `夜里醒了两次`
- **THEN** the database blob is non-empty and is not the UTF-8 bytes of that note, and the HTTP response still returns the plaintext note to the owner

#### Scenario: Empty note is null
- **WHEN** a user creates a log with no note
- **THEN** `note_encrypted` is NULL

### Requirement: AES-GCM for wellness free text and report metrics
The system SHALL persist cycle symptoms, sleep notes, and report metrics JSON as AES-256-GCM ciphertext using T1 `FieldCrypto`. Dates, millilitres, and sleep quality MUST remain plaintext. The database row MUST NOT contain the UTF-8 plaintext of a non-empty symptom, sleep note, or metrics JSON.

#### Scenario: Symptom ciphertext is not plaintext
- **WHEN** a consented user creates a cycle with symptoms 痛经
- **THEN** the well_cycles row stores a non-empty symptoms_encrypted blob that is not the UTF-8 bytes of 痛经
- **AND** a later GET of that cycle returns symptoms 痛经

#### Scenario: Sleep note ciphertext is not plaintext
- **WHEN** a user creates a sleep log with note 夜里醒了
- **THEN** the well_sleep_logs row stores a non-empty note_encrypted blob that is not the UTF-8 bytes of 夜里醒了
- **AND** a later GET of that log returns note 夜里醒了

#### Scenario: Report metrics ciphertext is not plaintext
- **WHEN** a user creates a report whose metrics JSON includes 血压
- **THEN** the well_reports row stores a non-empty metrics_encrypted blob that is not the UTF-8 bytes of that JSON
- **AND** a later GET of that report returns the metrics array

#### Scenario: Empty note is null
- **WHEN** a user creates a sleep log with no note
- **THEN** `note_encrypted` is NULL
