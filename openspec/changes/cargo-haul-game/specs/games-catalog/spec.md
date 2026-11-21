# games-catalog Delta (proposal — do not apply until approved)

## ADDED Requirements

### Requirement: 重卡 catalog game

WHEN approved, the registry SHALL include playable `cargo-haul` (title 重卡, category 驾驶, play CTA 开始开车) with play route `/modules/games/cargo-haul/play`. UNTIL approved, the registry SHALL NOT list this id.

#### Scenario: Not shipped as a stub

- **WHEN** this change is still a proposal
- **THEN** `getGame('cargo-haul')` is undefined
