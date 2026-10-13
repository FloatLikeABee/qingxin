# Spec Delta

## ADDED Requirements

### Requirement: Stream is injectable
`AiGateway` SHALL expose `stream` in addition to `complete`. The default implementation MAY chunk a successful `complete` result. `POST /v1/tools/{tool_id}/run` SHALL call `stream`. A test double that only implements `complete` SHALL still be enough for a toolbox run to stream that text.

#### Scenario: Complete-only double streams
- **WHEN** the server is built with a gateway that only implements `complete` and returns a fixed sentence
- **THEN** a toolbox run SSE body contains that sentence in a `data:` delta

#### Scenario: Complete route unchanged
- **WHEN** an authenticated user posts `POST /v1/ai/complete` against `UnconfiguredAiGateway`
- **THEN** the response is still 501 with error code `ai_unconfigured`
