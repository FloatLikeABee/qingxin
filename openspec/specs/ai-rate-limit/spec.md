# ai-rate-limit Specification

## Purpose
Caps how many gateway requests a single user can make in a time window so one account cannot starve others.

## Requirements

### Requirement: Per-user rate limit
The system SHALL count complete and stream attempts per user id against a configured maximum in a sliding time window. When the user exceeds that maximum, the system SHALL return a typed rate-limit error that includes a retry-after duration and SHALL NOT call a provider. Limits SHALL NOT be shared across different user ids.

#### Scenario: Excess requests are rejected
- **WHEN** the limit is 2 requests per 60 seconds and the same user calls complete a third time inside that window
- **THEN** the third call returns a rate-limit error and the mock provider invocation count stays two

#### Scenario: Limits are isolated per user
- **WHEN** user A is already at the limit and user B calls complete
- **THEN** user B’s call succeeds

### Requirement: Rate limit precedes provider and cache write
The system SHALL apply the rate limit before calling a provider. A rejected call SHALL NOT write a new cache entry.

#### Scenario: Rate-limited call does not increment provider count
- **WHEN** a user who is already at the limit calls complete
- **THEN** no provider is invoked
