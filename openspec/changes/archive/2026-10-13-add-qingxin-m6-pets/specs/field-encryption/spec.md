# Spec Delta

## ADDED Requirements

### Requirement: AES-GCM for pet health notes
The system SHALL persist pet health-record notes as AES-256-GCM ciphertext using T1 `FieldCrypto`. Type and date columns MUST remain plaintext. The database row MUST NOT contain the UTF-8 plaintext of a non-empty note.

#### Scenario: Note ciphertext is not plaintext
- **WHEN** a user creates a health record with note `阿莫西林一周`
- **THEN** the `pet_health_records` row stores a non-empty `note_encrypted` blob that is not the UTF-8 bytes of that note
- **AND** a later GET of that record returns note `阿莫西林一周`
