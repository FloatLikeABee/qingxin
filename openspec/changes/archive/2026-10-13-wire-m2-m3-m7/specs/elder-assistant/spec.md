## ADDED Requirements

### Requirement: Medication modal opens only when due
The care page SHALL open the 该吃药了 modal only when `GET /v1/elder/today` has a reminder scheduled today (Asia/Shanghai ISO weekday in `days_of_week`), its local time has passed, it is within the 60-minute miss-check grace window, and it has not been acknowledged for today's date. Confirmations SHALL be stored per day. The client MUST NOT seed a demo reminder.

#### Scenario: First visit before dose time
- **WHEN** a user opens the care page at 07:00 on a Monday with an 08:00 weekday reminder
- **THEN** no modal is shown

#### Scenario: Dose due
- **WHEN** it is 08:05 Monday and the reminder is not acked today
- **THEN** the modal opens

#### Scenario: Weekend closed
- **WHEN** it is Saturday 08:05 and the reminder is weekdays only
- **THEN** no modal is shown

#### Scenario: Acked today stays closed
- **WHEN** the reminder was acked today and it is still within the grace window
- **THEN** no modal is shown

#### Scenario: Acked yesterday
- **WHEN** the reminder was acked yesterday and it is 08:05 today on a scheduled weekday
- **THEN** the modal opens again

#### Scenario: Outside grace
- **WHEN** it is more than 60 minutes after the scheduled time and the dose is unacked
- **THEN** no modal is shown
