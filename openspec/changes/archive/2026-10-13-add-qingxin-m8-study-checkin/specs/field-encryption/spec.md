# Spec Delta

## ADDED Requirements

### Requirement: AES-GCM for study flashcards and notes
The system SHALL persist flashcard front/back and study-note Markdown as AES-256-GCM ciphertext using T1 `FieldCrypto`. Titles, tags, categories, dates, ease and interval MUST remain plaintext. The database row MUST NOT contain the UTF-8 plaintext of a non-empty front, back, or content_md.

#### Scenario: Flashcard front ciphertext is not plaintext
- **WHEN** a user creates a flashcard with front 过去分词
- **THEN** the study_flashcards row stores a non-empty front_encrypted blob that is not the UTF-8 bytes of 过去分词
- **AND** a later GET of that card returns front 过去分词

#### Scenario: Note Markdown ciphertext is not plaintext
- **WHEN** a user creates a study note with content_md # 摘要
- **THEN** the study_notes row stores a non-empty content_md_encrypted blob that is not the UTF-8 bytes of that Markdown
- **AND** a later GET of that note returns the plaintext Markdown

#### Scenario: Empty note body is null
- **WHEN** a user creates a study note with no content_md
- **THEN** content_md_encrypted is NULL
