# Spec Delta

## Purpose
Persists reminder-style jobs and delivers them through a Web Push seam so modules can schedule notifications without a separate worker process.

## ADDED Requirements

### Requirement: Schedule a job
An authenticated user SHALL be able to `POST /v1/jobs` with `kind` `web_push` and a future or past `run_at`. The job SHALL persist as `pending` and appear in `GET /v1/jobs`.

#### Scenario: Create and list
- **WHEN** a user posts a `web_push` job
- **THEN** the response is 201 with `status` `pending` and the job id appears in a later list

### Requirement: Due jobs invoke the push sender
The in-process scheduler SHALL claim due `pending` jobs with a compare-and-set to `running` and SHALL call `PushSender` once per claimed job. A successful send SHALL mark the job `done`.

#### Scenario: Due job is sent
- **WHEN** a pending job has `run_at` in the past and the scheduler ticks
- **THEN** the configured push sender receives that job and the job status becomes `done`

### Requirement: Store Web Push subscriptions
An authenticated principal SHALL be able to store a subscription (`endpoint`, `p256dh`, `auth`) and read a VAPID public key when one is configured.

#### Scenario: Subscribe
- **WHEN** a user posts a valid subscription
- **THEN** the response is 201 and the subscription id is present
