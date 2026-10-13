# Spec Delta

## Purpose
Gives a short, offline-capable rest toolkit: 4-7-8 breathing, a synthesized white-noise mixer, a bedtime-story reader, and a fullscreen timer, with persisted sessions.

## ADDED Requirements

### Requirement: Session persistence
`POST /v1/meditation/sessions` SHALL record `kind` (`breathe` | `noise` | `story` | `timer`), `duration_sec` ≥ 0, and optional `payload`. `GET /v1/meditation/sessions` SHALL list the caller's sessions newest first. Unknown `kind` SHALL return 400. Account deletion SHALL cascade these rows.

#### Scenario: Breathe session is stored
- **WHEN** a signed-in client posts `{ "kind": "breathe", "duration_sec": 76, "payload": { "cycles": 4 } }`
- **THEN** the response is 201 and a later list includes that id and kind

#### Scenario: Unknown kind
- **WHEN** a client posts `kind=yoga`
- **THEN** the response is 400 with error code `invalid_request`

### Requirement: Catalog
`GET /v1/meditation/catalog` SHALL return the closed lists of sound presets and bedtime stories (id, title, body). The web mock SHALL expose the same ids so offline UI matches the API.

#### Scenario: Catalog includes required tools
- **WHEN** a client fetches the catalog
- **THEN** it includes sound ids `rain`, `waves`, `fan`, `fire`, `white` and at least two zh-CN stories

### Requirement: 4-7-8 breathing
The web module SHALL run a 4-7-8 cycle (inhale 4s, hold 7s, exhale 8s) with a labeled animation that stops when `prefers-reduced-motion: reduce` (phase labels still update). A cycle helper SHALL be unit-tested.

#### Scenario: Phase offsets
- **WHEN** elapsed seconds inside a cycle are 0, 4, and 11
- **THEN** the helper reports inhale, hold, and exhale respectively

### Requirement: Mixer, story, timer
The mixer SHALL start Web Audio only after a user gesture and SHALL expose independent preset levels. The story reader SHALL show the full catalog text at ≥16px. The timer SHALL offer presets and a fullscreen overlay with a ≥44px close control.

#### Scenario: Audio starts from a gesture
- **WHEN** the user has not pressed 开始混合
- **THEN** no `AudioContext` is running
