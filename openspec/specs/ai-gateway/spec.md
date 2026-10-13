# ai-gateway Specification

## Purpose
Defines the `Ai` seam Qingxin modules and Forge’s API call for chat completions, including sequential provider fallback and SSE-encoded streams.

## Requirements

### Requirement: Ai seam complete and stream
The system SHALL expose a single `Ai` seam that accepts a user id plus an ordered list of chat messages and returns either a completed assistant message or a stream of assistant deltas. Callers SHALL NOT need to name a concrete provider to get a result.

#### Scenario: Complete returns assistant text
- **WHEN** a caller invokes complete with a non-empty message list and a mock provider that replies "ok"
- **THEN** the seam returns that assistant text, the provider that served it, and a per-request token usage object

#### Scenario: Stream yields deltas then completion
- **WHEN** a caller invokes stream against a mock provider that emits the tokens "轻" then "心"
- **THEN** the stream yields those deltas in order and finishes with a terminal event that includes token usage

### Requirement: Sequential provider fallback
When the preferred provider errors or exceeds its timeout, the system SHALL try the next configured provider in order and SHALL NOT retry the failed provider for that request. If every provider fails, the system SHALL return a single aggregated error that names each failed provider without including secrets.

#### Scenario: Fallback after provider error
- **WHEN** the first provider returns an error and a later provider succeeds
- **THEN** complete returns the later provider’s response and records that provider as the one that served the request

#### Scenario: Fallback after timeout
- **WHEN** the first provider exceeds the configured timeout and a later provider succeeds
- **THEN** complete returns the later provider’s response

#### Scenario: All providers fail
- **WHEN** every configured provider errors or times out
- **THEN** the seam returns an aggregated failure and does not return partial assistant text

### Requirement: SSE encoding
The system SHALL encode stream events as `text/event-stream` frames whose `data:` payload is an OpenAI-compatible chat-completion chunk, ending with a `data: [DONE]` frame.

#### Scenario: Delta becomes an SSE data frame
- **WHEN** the stream encoder is given a text delta "心"
- **THEN** it produces a frame that starts with `data: ` and whose JSON includes that delta text

#### Scenario: Stream end is OpenAI DONE
- **WHEN** the stream encoder is given the terminal event
- **THEN** it produces a `data: [DONE]` frame

### Requirement: Invalid request rejected
The system SHALL reject a complete or stream call that has an empty user id or an empty message list with a typed invalid-request error and SHALL NOT call any provider.

#### Scenario: Empty messages
- **WHEN** complete is called with no messages
- **THEN** it returns an invalid-request error and the mock provider invocation count stays zero
