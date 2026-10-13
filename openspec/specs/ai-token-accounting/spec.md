# ai-token-accounting Specification

## Purpose
Records how many prompt and completion tokens each request used and accumulates those totals per user so the API can enforce quotas later.

## Requirements

### Requirement: Per-request token usage
Every successful complete response and every stream terminal event SHALL include prompt token count and completion token count for that request. When a provider omits usage, the system SHALL estimate tokens from the request and response text so the fields are always present.

#### Scenario: Mock usage is returned
- **WHEN** the mock provider is scripted with 9 prompt tokens and 4 completion tokens
- **THEN** complete returns those exact counts on the response

### Requirement: Per-user ledger
The system SHALL accumulate request count, prompt tokens, and completion tokens per user id. Cache hits SHALL still add the cached request’s usage to the ledger so accounting reflects answers the user received.

#### Scenario: Two requests accumulate
- **WHEN** the same user completes two successful requests that use 10 and 6 total tokens
- **THEN** the user’s ledger shows request count 2 and total tokens 16

#### Scenario: Cache hit still counts
- **WHEN** a user’s second identical complete is an exact cache hit of a 12-token response
- **THEN** the user’s ledger request count is 2 and total tokens are 24
