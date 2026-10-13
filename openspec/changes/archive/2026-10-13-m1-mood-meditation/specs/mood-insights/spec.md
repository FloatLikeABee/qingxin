# Spec Delta

## Purpose
Offers an empathetic, non-medical insight after a check-in and a monthly summary, always through the `AiGateway` seam and a deterministic mock until Echo wires a real gateway.

## ADDED Requirements

### Requirement: Insight uses the AI seam
`POST /v1/mood/insights` SHALL require an access token and a body that is either `{ "mood_log_id" }` or `{ "emoji", "tags", "note" }`. The handler SHALL call `AiGateway::complete`. If that returns `Unconfigured`, the handler SHALL return a deterministic zh-CN paragraph derived from emoji and sorted tags. The JSON SHALL include `text`, `disclaimer`, and `source` (`gateway` or `mock`). The disclaimer SHALL state that the text is not medical advice. The handler SHALL NOT call any model provider HTTP API.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts a valid insight request
- **THEN** the response is 200, `source` is `mock`, `text` is non-empty zh-CN, and `disclaimer` contains `不构成医疗建议`

#### Scenario: Injected gateway is used
- **WHEN** a test double `AiGateway` returns a fixed sentence
- **THEN** the response is 200, `source` is `gateway`, and `text` is that sentence

#### Scenario: Same inputs are deterministic
- **WHEN** two mock insight requests use the same emoji and the same tags in different order
- **THEN** both `text` values are identical

### Requirement: Monthly summary
`GET /v1/mood/summaries/monthly?month=YYYY-MM` SHALL return a deterministic or gateway-backed summary of that month's logs for the caller, plus the same disclaimer. A month with no logs SHALL still return 200 with a gentle empty-state sentence, not 404.

#### Scenario: Empty month
- **WHEN** the caller has no logs in the requested month
- **THEN** the response is 200 and `text` explains that there is not enough data yet

### Requirement: Client presents insight as streamed mock
The web client SHALL reveal insight `text` in chunks (typewriter) unless `prefers-reduced-motion: reduce`, in which case it SHALL show the full text immediately. The UI SHALL always show the disclaimer.

#### Scenario: Reduced motion skips the typewriter
- **WHEN** the user prefers reduced motion
- **THEN** the insight paragraph appears in one paint
