# Spec Delta

## Purpose
Provides a content-moderation trait so later UGC modules can swap a vendor implementation without changing call sites.

## ADDED Requirements

### Requirement: No-op moderator allows content
The default `Moderator` implementation SHALL return an allow decision for any input, including empty and obviously unsafe strings. It SHALL NOT perform network I/O.

#### Scenario: No-op allows arbitrary text
- **WHEN** the no-op moderator checks a string
- **THEN** the decision is allow

### Requirement: Moderator is injectable
Application state SHALL hold a `Moderator` implementation so a later vendor adapter can replace the no-op without changing module call sites.

#### Scenario: State exposes the trait
- **WHEN** a caller asks the application state to moderate text
- **THEN** the call is dispatched to the configured `Moderator` and not to a hard-coded function
