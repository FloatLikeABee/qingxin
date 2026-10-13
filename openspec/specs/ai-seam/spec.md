# ai-seam Specification

## Purpose
Reserves an in-process AI gateway trait and HTTP completion route so Echo can attach providers later without rewriting callers.

## Requirements

### Requirement: Unconfigured gateway
The default `AiGateway` implementation SHALL not call any model provider. `POST /v1/ai/complete` with a valid access token SHALL return 501 with error code `ai_unconfigured`.

#### Scenario: Completion is not implemented
- **WHEN** an authenticated user posts a completion request
- **THEN** the response is 501 with error code `ai_unconfigured`

### Requirement: Trait is injectable
The HTTP handler SHALL call `AiGateway::complete` on the process state. A test double that returns text SHALL be enough for the route to respond 200 with that text.

#### Scenario: Injected gateway is used
- **WHEN** the server is built with a gateway that returns a fixed completion
- **THEN** `POST /v1/ai/complete` returns 200 and that completion text
