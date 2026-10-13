# Spec Delta

## Purpose
Exposes a cheap readiness signal so CI, hosts, and the PWA can tell the API process and its database are alive.

## ADDED Requirements

### Requirement: Health endpoint
The system SHALL serve `GET /health` without authentication. The handler SHALL ping the database. When the ping succeeds the response status SHALL be 200 and the body SHALL include `status` equal to `ok` and `db` equal to `ok`. When the ping fails the response status SHALL be 503 and `status` SHALL be `degraded`.

#### Scenario: Healthy process and database
- **WHEN** a client calls `GET /health` and the database answers
- **THEN** the response is 200 with `status` `ok` and `db` `ok`

#### Scenario: Database ping fails
- **WHEN** a client calls `GET /health` and the database ping fails
- **THEN** the response is 503 with `status` `degraded`
