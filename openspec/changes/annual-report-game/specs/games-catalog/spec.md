# games-catalog Delta (proposal — do not apply until approved)

## ADDED Requirements

### Requirement: 年报 catalog game

WHEN approved, the registry SHALL include playable `annual-report` (title 年报, category 经营, play CTA 打开年报). Play SHALL show a fictional-data disclaimer. UNTIL approved, the registry SHALL NOT list this id.

#### Scenario: Not shipped as a stub

- **WHEN** this change is still a proposal
- **THEN** `getGame('annual-report')` is undefined
