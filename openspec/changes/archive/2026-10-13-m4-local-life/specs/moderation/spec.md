# Spec Delta

## ADDED Requirements

### Requirement: Local-life UGC is moderated before persist
Review `content` and published service `name` plus `address` SHALL be passed through the configured `Moderator` before insert. A reject decision SHALL return 400 `invalid_request` and SHALL NOT persist the row. The default no-op moderator SHALL continue to allow.

#### Scenario: Rejecting moderator blocks a review
- **WHEN** the application state uses a moderator that rejects and a client posts a review
- **THEN** the response is 400 and the reviews table does not gain a new row

#### Scenario: No-op still allows
- **WHEN** the default no-op moderator is configured and a client posts a valid review
- **THEN** the response is 201
