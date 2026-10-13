# Spec Delta

## Purpose

Keeps vendor API keys out of the repository and out of logs so local development and CI never leak credentials.

## ADDED Requirements

### Requirement: Keys from environment or config only
The system SHALL read vendor API keys and base URLs from environment variables or an explicit config value passed by the caller. The crate SHALL NOT contain a default production API key. Missing keys SHALL disable that vendor adapter rather than panic.

#### Scenario: Missing DashScope key omits the adapter
- **WHEN** configuration is loaded with no DashScope key set
- **THEN** the fallback chain does not include DashScope and the process still starts

#### Scenario: Key supplied via env
- **WHEN** `DASHSCOPE_API_KEY` is set to a non-empty value
- **THEN** the DashScope adapter is present and uses that value as its bearer token

### Requirement: Secrets are not logged or debug-printed
Debug, Display, and tracing output for config and adapter types SHALL omit raw API keys. A key MUST never appear in a formatted error string.

#### Scenario: Debug redacts keys
- **WHEN** a config value holding key `sk-secret-test` is formatted with Debug
- **THEN** the formatted string does not contain `sk-secret-test`

### Requirement: Local-only delivery
The change SHALL NOT add cloud deploy configuration (Render, Netlify, Vercel, or equivalent). Tests SHALL run with the mock provider and no network.

#### Scenario: No cloud deploy files
- **WHEN** the change is reviewed
- **THEN** it contains no new Render/Netlify/Vercel service definition for the gateway
