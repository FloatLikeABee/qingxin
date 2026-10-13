# Spec Delta

## ADDED Requirements

### Requirement: Create operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/create/update creations, list templates and inspiration, request generate/titles/polish/outline, list/create snippets, and increment snippet usage, and SHALL include creations and snippets on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M9 operations
- **WHEN** a caller uses the API client
- **THEN** it can create and list creations, list templates by platform, request generate, titles, polish, and outline, and create or use a snippet

#### Scenario: Mock enforces platform catalog
- **WHEN** the mock client generates with platform `微博`
- **THEN** it rejects with a typed `invalid_request` error
