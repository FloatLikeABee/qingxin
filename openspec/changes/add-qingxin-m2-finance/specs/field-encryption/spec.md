# Spec Delta

## ADDED Requirements

### Requirement: AES-GCM for transaction notes
The system SHALL persist finance transaction notes as AES-256-GCM ciphertext using T1 `FieldCrypto`. Amounts MUST remain plaintext integer fen. The database row MUST NOT contain the UTF-8 plaintext of a non-empty note.

#### Scenario: Note ciphertext is not plaintext
- **WHEN** a user creates a transaction with note 午饭
- **THEN** the fin_transactions row stores a non-empty note_encrypted blob that is not the UTF-8 bytes of 午饭
- **AND** a later GET of that transaction returns note 午饭

#### Scenario: Amounts stay aggregatable
- **WHEN** two expenses of 1000 and 2000 fen exist in the same month
- **THEN** the monthly summary expense total is 3000 fen computed from plaintext amount_fen
