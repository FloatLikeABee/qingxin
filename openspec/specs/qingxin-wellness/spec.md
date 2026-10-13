# qingxin-wellness Specification

## Purpose
Gives an authenticated Qingxin user a non-medical habit toolkit: water progress and reminders, sleep check-ins, consented period tracking with average-based prediction, metrics-only checkup notes, and 21-day plans, without diagnosis or contraception guidance.

## Requirements

### Requirement: Owner isolation
Wellness endpoints MUST derive the owner from the T1 AuthUser JWT or device session and MUST NOT expose or modify another user's data. Other users' ids MUST return 404. Missing or invalid tokens MUST return 401.

#### Scenario: Other user's water log
- **WHEN** user A requests or edits a water log id owned by user B
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a request has no valid access token
- **THEN** the API responds 401 with error code unauthenticated

### Requirement: Caregivers never see wellness data
A linked caregiver MUST NOT read or write the dependent's wellness records. Wellness routes MUST NOT accept an elder_id override.

#### Scenario: Caregiver cannot fetch dependent water log
- **WHEN** caregiver C is linked to user E and C requests E's water log id
- **THEN** the API responds 404 and C's GET /v1/wellness/today shows only C's totals

### Requirement: Water goal progress
The system SHALL default the daily water target to 2000 ml. POST of a positive ml amount (default cup 250) SHALL add to today's total. GET today SHALL return total_ml and target_ml for the progress ring.

#### Scenario: Four cups toward 2000 ml
- **WHEN** target is 2000 ml and the user logs 4×250 ml on the same local day
- **THEN** today.water.total_ml is 1000 and today.water.target_ml is 2000

#### Scenario: Invalid ml rejected
- **WHEN** a client posts ml 0 or a negative value
- **THEN** the API responds 400 with the T1 error envelope and nothing is stored

### Requirement: Water reminders via scheduler
The system SHALL store reminder rules as HH:MM plus ISO weekdays (1–7). An interval window MUST be expanded server-side into inclusive fixed times. Each active water reminder MUST enqueue a T1 scheduled_jobs web_push job whose payload type is wellness.water so Web Push can fire where supported. Defaults MUST be every 2 hours from 08:00 through 22:00.

#### Scenario: Interval expanded inclusively
- **WHEN** the user sets an interval 09:00–13:00 every 2 hours on weekdays
- **THEN** three times 09:00, 11:00 and 13:00 are stored

#### Scenario: Default water times
- **WHEN** a new user loads today and has no water reminders
- **THEN** times 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 and 22:00 exist for all ISO weekdays

#### Scenario: Reminder job scheduled
- **WHEN** an active water reminder exists with a future next occurrence
- **THEN** a pending scheduled job exists for that user whose payload type is wellness.water
- **AND** scheduler tick_once delivers it through PushSender

### Requirement: Sleep check-ins
The system SHALL store sleep_at, wake_at, quality 1–5, and an optional note. Quality outside 1–5 MUST be rejected. The note MUST be encrypted at rest.

#### Scenario: Overnight sleep with quality
- **WHEN** the user posts sleep_at 22:30, wake_at 06:30 and quality 4
- **THEN** a sleep log is stored for that user with those timestamps and quality 4

### Requirement: Period tracking requires explicit consent
Cycle create, patch, delete and prediction MUST require cycle_consent = true. Consent MUST default to false. Without consent the system MUST NOT store period data. Turning consent off MUST delete existing cycle rows. Writes without consent MUST return 403.

#### Scenario: Write blocked without consent
- **WHEN** a user with cycle_consent false POSTs a cycle start_date
- **THEN** the API responds 403 and no well_cycles row is inserted

#### Scenario: Consent revoke deletes cycles
- **WHEN** a user who stored a cycle sets cycle_consent false
- **THEN** no well_cycles rows remain for that user

### Requirement: Average-based cycle prediction
When consent is on, GET prediction SHALL compute the mean of the last at most 6 start-to-start cycle lengths, defaulting to 28 days when fewer than two starts exist, and MUST include label 仅供参考 plus the 非医疗建议 disclaimer. The API MUST NOT present the prediction as contraception guidance.

#### Scenario: Mean of two 28-day cycles
- **WHEN** the consented user has starts 2026-08-01 and 2026-08-29
- **THEN** prediction.average_length_days is 28, prediction.next_start is 2026-09-26, prediction.label is 仅供参考, and prediction.disclaimer is present

### Requirement: Metrics-only reports and OCR stub
Reports SHALL store title, report_date, encrypted metrics JSON, source and confirmed. The API MUST reject file uploads and file_url. POST /v1/wellness/reports/ocr SHALL call AiGateway with pasted text and create an unconfirmed report. Unconfigured AI MUST return 501 ai_unconfigured.

#### Scenario: Manual metrics stored
- **WHEN** the user POSTs title 体检, report_date 2026-10-01 and metrics [{name: 血压, value: 120/80, unit: mmHg}]
- **THEN** a report is stored with source manual and confirmed true, and GET returns those metrics

#### Scenario: OCR uses the gateway stub
- **WHEN** the user POSTs OCR text and the gateway returns a metrics JSON array
- **THEN** an unconfirmed report with source ai_stub is stored and the response includes the disclaimer

### Requirement: 21-day plans
The system SHALL let the user create a plan of kind water_21 or sleep_21 with default target_days 21 and check in at most once per day. Repeat POST of the same day MUST return the existing check-in.

#### Scenario: Double check-in
- **WHEN** the user checks in twice on the same day
- **THEN** one check-in is stored and progress_days increases by one

### Requirement: Not-medical-advice text is always shown
Home/today, cycle prediction, reports, OCR and plan-suggest responses MUST include the 非医疗建议 disclaimer. Wellness pages MUST render that notice. Predictions MUST be labelled 仅供参考.

#### Scenario: Today includes disclaimer
- **WHEN** an authenticated user calls GET /v1/wellness/today
- **THEN** the body contains disclaimer 本模块为生活习惯记录工具，不构成医疗建议。身体不适请及时就医。

### Requirement: Elder tokens inherited
Wellness pages MUST size text and contrast using the global `--qx-font-size` and document contrast tokens. They MUST NOT introduce a module-local elder-mode setting.

#### Scenario: Global text size
- **WHEN** the document root sets --qx-font-size to 1.25rem
- **THEN** wellness page copy inherits that size through rem-based styles
