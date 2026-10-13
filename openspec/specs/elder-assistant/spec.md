# elder-assistant Specification

## Purpose
Lets a linked caregiver remotely manage an elder Qingxin account while the elder uses a few large actions: today’s reminders, emergency calls, step tutorials, and a sourced anti-fraud library.

## Requirements

### Requirement: Reuse T1 caregiver binding and device login
M3 SHALL NOT add a second invite or token scheme. An elder is a normal user. A caregiver reaches that user only through T1 caregiver invites, links, and device sessions. Elder-scoped routes MUST accept the same `Authorization: Device` credential T1 issues for that elder.

#### Scenario: Device session is the elder
- **WHEN** a linked caregiver issues a T1 device for the elder and the tablet calls `GET /v1/elder/today` with `Authorization: Device`
- **THEN** the response is 200 and the today payload is that elder’s

#### Scenario: No parallel invite route
- **WHEN** a client calls a non-existent `POST /v1/elder/links/invite`
- **THEN** the API responds 404

### Requirement: Scoped remote management returns 404
Elder reminders, contacts, tutorials, and profile SHALL be readable or writable only by that elder or by a user with an active T1 `caregiver_links` row. Any other authenticated caller MUST receive 404. Unauthenticated callers MUST receive 401.

#### Scenario: Caregiver creates a reminder
- **WHEN** a linked caregiver posts a medication reminder at 08:00 on weekdays
- **THEN** it appears in the elder’s today list and records the caregiver as `created_by`

#### Scenario: Stranger is hidden
- **WHEN** a user without an active link lists another user’s reminders
- **THEN** the API responds 404

#### Scenario: Missing credentials
- **WHEN** a client lists reminders without an Authorization header
- **THEN** the API responds 401 with error code `unauthenticated`

#### Scenario: Revoked link
- **WHEN** the elder deletes the T1 caregiver link and the former caregiver lists that elder’s reminders
- **THEN** the API responds 404

### Requirement: Reminder schedule is time plus weekdays
A reminder SHALL store a local `HH:MM` time, a non-empty set of ISO weekdays (1=Monday through 7=Sunday), and a timezone. The API MUST reject cron strings and empty weekday lists.

#### Scenario: Weekday reminder is accepted
- **WHEN** a caregiver posts `time` `08:00` and `days_of_week` `[1,2,3,4,5]`
- **THEN** the reminder is stored with that time and those days

#### Scenario: Cron is rejected
- **WHEN** a client posts `schedule_cron` instead of time and weekdays
- **THEN** the API responds 400 with error code `invalid_request`

### Requirement: Reminder delivery and disclaimer
Due reminders SHALL be delivered as an in-app modal with spoken zh-CN text and a large confirm control, and as a T1 `web_push` job when the scheduler runs. Elder today and the due modal MUST show that reminders are not alarm-reliable.

#### Scenario: Due reminder is pushed
- **WHEN** a reminder occurrence is due and the T1 scheduler ticks
- **THEN** the configured push sender receives a job whose payload type is `elder_reminder`

#### Scenario: Disclaimer is present
- **WHEN** the elder loads today
- **THEN** the payload includes a visible disclaimer that reminders are not alarm-reliable

### Requirement: Idempotent acknowledgement
Acknowledging a reminder occurrence SHALL persist at most one ack for that `(reminder_id, occurrence_at)` pair, including retries.

#### Scenario: Duplicate ack
- **WHEN** the elder posts ack twice for the same occurrence
- **THEN** one acknowledgement event exists and both responses are success

### Requirement: Missed dose notifies the caregiver
If an occurrence is still un-acked when its miss-check job runs, the system SHALL mark it missed, create an in-app notice for each linked caregiver, and write a T1 SMS-stub log row. It MUST NOT call a carrier.

#### Scenario: Unacked occurrence becomes missed
- **WHEN** the miss-check job runs and the occurrence is not acked
- **THEN** each linked caregiver has a missed-dose notice and an `elder_sms_log` row exists with purpose `missed_dose`

#### Scenario: Acked occurrence is not missed
- **WHEN** the elder acks before the miss-check job runs
- **THEN** no missed-dose notice is created for that occurrence

### Requirement: Emergency contacts stay encrypted
Contact phones SHALL be stored as AES-GCM ciphertext. Lists SHALL include name, relation, and a dialable number, and MUST always include emergency numbers 120 and 110 even when the elder is offline on the client.

#### Scenario: Phone is not plaintext at rest
- **WHEN** a contact is saved
- **THEN** the database blob is not the raw E.164 string and a later authorized GET returns the decrypted number

#### Scenario: Emergency numbers are always listed
- **WHEN** the elder or a linked caregiver lists contacts
- **THEN** the list includes 120 and 110

### Requirement: Step tutorials
The system SHALL serve system tutorials and family-authored tutorials as ordered steps with text, optional image URL, and a read-aloud control. Family tutorials SHALL be private to that elder.

#### Scenario: System tutorial is listed
- **WHEN** an authenticated user gets system tutorials
- **THEN** the list includes 医院挂号, 社保认证, and 健康码/扫码

#### Scenario: Family tutorial is private
- **WHEN** a stranger requests another elder’s family tutorials
- **THEN** the API responds 404

### Requirement: Sourced anti-fraud library
The system SHALL ship a small seed of fraud-script cards. Each card MUST include `source_name` and `source_url` citing a public 国家反诈中心 source or official republication. Seed rows SHALL be PATCH-able only by a content editor.

#### Scenario: Seed cites a source
- **WHEN** an authenticated user lists fraud scripts
- **THEN** every item has a non-empty `source_name` and `source_url`

#### Scenario: Non-editor cannot patch
- **WHEN** a user who is not a content editor PATCHes a fraud script
- **THEN** the API responds 403 or 404

### Requirement: Suspicious numbers are hashed
Flagged numbers SHALL be stored as a keyed lookup hash, never as raw digits in the shared flag table. A check SHALL return only whether the number has been flagged and a count, without who flagged it.

#### Scenario: Check a flagged number
- **WHEN** a user flags a number and another user checks that number
- **THEN** the check response has `flagged` true and does not include the other user’s id

### Requirement: Activity log is opt-in
The activity log MUST NOT contain call audio or raw phone numbers. Caregivers SHALL read it only after the elder sets `activity_log_opt_in`. Otherwise the caregiver GET MUST be 404. Only the elder MAY change that flag.

#### Scenario: Caregiver without opt-in
- **WHEN** a linked caregiver gets the activity log and the elder has not opted in
- **THEN** the API responds 404

#### Scenario: Elder enables the log
- **WHEN** the elder sets `activity_log_opt_in` true and a linked caregiver gets the log
- **THEN** the API responds 200 with events that omit raw phone numbers

#### Scenario: Caregiver cannot enable the log
- **WHEN** a linked caregiver PATCHes the elder profile to enable the log
- **THEN** the API responds 404

### Requirement: Elder AI stays on the gateway seam
Any M3 server-side generated text SHALL call the existing `AiGateway` trait. When the gateway is unconfigured the route MUST return 501 with error code `ai_unconfigured`.

#### Scenario: Explain is stubbed
- **WHEN** an authenticated user posts `POST /v1/elder/ai/explain` on the default process
- **THEN** the response is 501 with error code `ai_unconfigured`
