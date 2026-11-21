# games-catalog Delta (proposal — do not apply until approved)

## ADDED Requirements

### Requirement: 手术 catalog game

WHEN approved **and** a visual lane is chosen, the registry SHALL include playable `operation` (title 手术, play CTA 开始手术) with a body hub that exposes at least four distinct v1 procedures. UNTIL then, the registry SHALL NOT list this id.

#### Scenario: Not shipped as a stub

- **WHEN** this change is still a proposal
- **THEN** `getGame('operation')` is undefined
