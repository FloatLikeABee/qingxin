# games-catalog Delta

## ADDED Requirements

### Requirement: 年报 catalog game

The registry SHALL include playable `annual-report` (title 年报, englishTitle Annual Report, category 经营, tags 表格/虚构/财务, play CTA 打开年报) with play route `/modules/games/annual-report/play`. Detail and play SHALL show the fictional-data disclaimer.

#### Scenario: Shipped playable, not a stub

- **WHEN** a guest opens the games catalog
- **THEN** `getGame('annual-report')` is defined, category 经营 lists it, and 打开年报 routes to `/modules/games/annual-report/play`
