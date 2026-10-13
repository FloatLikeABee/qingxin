# Spec Delta

## ADDED Requirements

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
