# secrets-mailbox Specification

## Purpose
A private artistic mailbox: the user posts a letter-like secret; the system replies with a letter on a board. Not a chat. Not public.

## Requirements

### Requirement: Consent before send
The system SHALL reject a secret that has no explicit consent that the text will be used only to write a private reply and will not be published.

#### Scenario: Missing consent
- **WHEN** a user submits a non-empty body with `consented: false`
- **THEN** the send is rejected with a zh-CN reason that names consent and non-publication

### Requirement: Owner-only encrypted storage
Secret and reply bodies SHALL be stored with AES-256-GCM. List and get SHALL require the owner. Another user SHALL NOT receive the letter. The ciphertext SHALL NOT contain the plaintext.

#### Scenario: Isolation
- **WHEN** user A posts a letter and user B lists letters
- **THEN** user B's list does not include A's letter

### Requirement: Letter board, not chat
The board model SHALL expose envelopes with roles `secret` and `reply`. Rendering SHALL NOT use chat timestamps as a messenger thread. AI copy SHALL read as a letter (salutation and closing), not as a chat turn.

#### Scenario: Reply is a letter
- **WHEN** the mailbox replies
- **THEN** the reply contains a letter closing such as `此致` and does not use `用户:` / `助手:` prefixes

### Requirement: Careful product copy
The module SHALL state it is not counseling or crisis care and SHALL point to the existing 12356 hotline. Secret bodies SHALL NOT be written to localStorage.

### Requirement: Privacy export and delete
Owner export SHALL include decrypted letters. Account deletion SHALL cascade secret rows.
