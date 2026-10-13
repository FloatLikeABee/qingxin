# Spec Delta

## ADDED Requirements

### Requirement: Resume preview ignores dark tokens
The resume A4 preview SHALL keep the light palette even when the document root has class `dark`. Surrounding chrome SHALL continue to use the existing four theme modes.

#### Scenario: Dark chrome, light page
- **WHEN** the user selects 深色 and opens the resume workshop
- **THEN** the module chrome uses dark tokens and the A4 preview background is `#FFFFFF`

### Requirement: Kanban dark elevation and status tags
In dark appearance, application kanban cards SHALL use a deeper shadow than the default kit Card. Status tags for 投递 / 面试 / Offer SHALL be highlighted (distinct fill plus a visible ring) in both light and dark.

#### Scenario: Highlighted Offer tag
- **WHEN** a kanban card is in status Offer
- **THEN** its status tag uses the offer highlight tone (green fill and ring)
