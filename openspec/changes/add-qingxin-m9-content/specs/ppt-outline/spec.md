# Spec Delta

## Purpose

Turns a topic into a structured presentation outline through the AiGateway seam, then exports that outline as Markdown or a client-generated PPTX.

## ADDED Requirements

### Requirement: Outline uses the AI seam
`POST /v1/create/outline` SHALL require an access token and a non-empty `topic`. It SHALL call `AiGateway::complete` and fall back to a deterministic outline when the gateway is Unconfigured or empty. The JSON SHALL include `title`, `slides` (each with `heading` and `bullets`), `markdown`, `disclaimer`, and `source`. There SHALL be at least three slides. The handler SHALL NOT call any model provider HTTP API.

#### Scenario: Unconfigured gateway falls back to mock
- **WHEN** `AppState.ai` is `UnconfiguredAiGateway` and a client posts `{ "topic": "季度复盘" }`
- **THEN** the response is 200, `source` is `mock`, `slides` has length at least 3, `markdown` contains the topic, and `disclaimer` contains `不构成`

#### Scenario: Injected gateway is used
- **WHEN** a test double `AiGateway` returns a fixed sentence
- **THEN** the response is 200, `source` is `gateway`, and `title` or the first slide heading includes that sentence

### Requirement: Markdown export
The web client SHALL serialize an outline to a Markdown document whose first heading is the outline title and whose subsequent `##` headings match slide headings.

#### Scenario: Markdown contains slides
- **WHEN** `outlineToMarkdown` is called with title `季度复盘` and one slide heading `成果`
- **THEN** the Markdown contains `# 季度复盘` and `## 成果`

### Requirement: Client PPTX export
The web client SHALL build a `.pptx` byte array from an outline without a network call. The bytes SHALL be a ZIP archive containing Office Open XML slide parts, and each slide heading SHALL appear in the archive.

#### Scenario: PPTX contains slide text
- **WHEN** `outlineToPptx` is called with two slides headed `封面` and `进展`
- **THEN** the bytes start with `PK` and decoding the archive finds both `封面` and `进展`
