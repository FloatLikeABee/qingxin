# ai-prompt-cache Specification

## Purpose
Avoids repeat provider calls for identical or semantically similar prompts by serving an exact-match cache first and a semantic cache second.

## Requirements

### Requirement: Exact-match cache
The system SHALL cache successful non-streamed and fully-collected streamed completions keyed by a hash of the normalized message list and model. An exact hit SHALL return the cached assistant text and SHALL NOT call a provider. Failed responses SHALL NOT be stored.

#### Scenario: Exact hit skips the provider
- **WHEN** complete is called twice with the same user-visible messages and model
- **THEN** the second call returns the first call’s assistant text with cache status `exact` and the mock provider invocation count stays one

#### Scenario: Failures are not cached
- **WHEN** the only provider errors and a later retry is made after the provider is scripted to succeed
- **THEN** the retry calls the provider again and returns the successful text

### Requirement: Semantic cache
When no exact key matches, the system SHALL query a semantic cache that compares an embedding of the latest user message (plus model) against stored entries. A similarity at or above the configured threshold SHALL return the stored completion with cache status `semantic` and SHALL NOT call a provider. Tests SHALL use a deterministic in-process embedder so no network or embedding model is required.

#### Scenario: Similar prompt hits semantic cache
- **WHEN** complete is first called with "Summarise the meeting notes" and then with "Summarize the meeting notes"
- **THEN** the second call returns the first completion with cache status `semantic` and the mock provider invocation count stays one

#### Scenario: Dissimilar prompt misses
- **WHEN** complete is first called with "Summarise the meeting notes" and then with "Write a poem about cats"
- **THEN** the second call invokes the provider and returns cache status `miss`

### Requirement: Cached streams replay
A cache hit on stream SHALL replay the stored assistant text as one or more deltas and a terminal event, without calling a provider.

#### Scenario: Stream exact hit replays
- **WHEN** complete has cached a reply and stream is called with the same messages
- **THEN** the stream yields the cached text and the mock provider invocation count stays one
