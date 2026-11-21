# games-catalog Delta

## ADDED Requirements

### Requirement: 重卡 catalog game

The registry SHALL include playable `cargo-haul` (title 重卡, englishTitle Heavy Haul, category 驾驶, tags 卡车/公路/无尽, play CTA 开始开车) with play route `/modules/games/cargo-haul/play`.

#### Scenario: Shipped playable, not a stub

- **WHEN** a guest opens the games catalog
- **THEN** `getGame('cargo-haul')` is defined, category 驾驶 is listed, and 开始开车 routes to `/modules/games/cargo-haul/play`
