# crisis-hotline Specification

## Purpose
Puts a national psychological-aid number one tap away, only after the person confirms they want to leave the app and place a call.

## Requirements

### Requirement: Confirm before dial
The mood module SHALL show a control labeled for 心理援助热线 12356. Activating it SHALL open a confirmation modal that states 轻心不提供危机干预或心理治疗. Confirming SHALL navigate to `tel:12356`. Dismissing SHALL leave the current page and SHALL NOT navigate.

#### Scenario: Confirm dials
- **WHEN** the user opens the hotline control and confirms
- **THEN** the client uses the URL `tel:12356`

#### Scenario: Cancel stays
- **WHEN** the user opens the hotline control and cancels
- **THEN** no `tel:` navigation happens
