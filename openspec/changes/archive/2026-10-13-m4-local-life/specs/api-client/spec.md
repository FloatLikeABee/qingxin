# Spec Delta

## ADDED Requirements

### Requirement: Local-life operations on the typed client
The TypeScript `QingxinApi` interface SHALL expose methods to list/search/sort services, fetch service detail, list/create reviews, flag corrections, and publish a service, and SHALL include the caller's reviews, submitted services, and corrections on export. Screens SHALL depend on that interface, not a concrete HTTP client.

#### Scenario: Interface covers M4 operations
- **WHEN** a caller uses the API client
- **THEN** it can list services, search `宠物医院`, sort by distance or rating, open detail, create a review, flag `电话空号`, and publish a service

#### Scenario: Mock enforces category catalog
- **WHEN** the mock client publishes a service with category `酒吧`
- **THEN** it rejects with a typed `invalid_request` error
