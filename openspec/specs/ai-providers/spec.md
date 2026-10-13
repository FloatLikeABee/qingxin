# ai-providers Specification

## Purpose
Names the OpenAI-compatible chat providers Qingxin can call and requires a network-free mock so the gateway can be tested without keys.

## Requirements

### Requirement: Supported provider set
The system SHALL implement OpenAI-compatible chat adapters for Ollama, DashScope (Qwen), Zhipu, and Kimi. Ollama SHALL be the default preferred provider when the caller does not override the chain.

#### Scenario: Default preferred provider is Ollama
- **WHEN** a gateway is built from default configuration with no provider override
- **THEN** the preferred provider in the fallback chain is Ollama

#### Scenario: Each named provider is constructible
- **WHEN** configuration supplies a base URL (and a key where the vendor requires one) for Ollama, DashScope, Zhipu, and Kimi
- **THEN** each adapter is present in the fallback chain under its stable provider id (`ollama`, `dashscope`, `zhipu`, `kimi`)

### Requirement: Mock provider for tests
The system SHALL provide an in-process mock provider that needs no network and no API keys. Tests SHALL be able to script success, error, timeout, streamed deltas, and token usage for that mock.

#### Scenario: Mock success without network
- **WHEN** a test builds a gateway whose only provider is the mock and calls complete
- **THEN** the call succeeds without opening a socket and without reading a vendor API key

#### Scenario: Mock can fail then succeed
- **WHEN** a test scripts the first mock to error and the second mock to return "fallback-ok"
- **THEN** complete returns "fallback-ok"

### Requirement: OpenAI-compatible request shape
Each non-mock adapter SHALL send chat completions to an OpenAI-compatible `/chat/completions` endpoint using the configured base URL, model, and bearer token (Ollama MAY omit the bearer token).

#### Scenario: DashScope uses compatible-mode path
- **WHEN** the DashScope adapter is configured with a base URL
- **THEN** its request path ends with `/chat/completions` and the Authorization header uses the configured key
