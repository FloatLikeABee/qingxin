# games-catalog Delta (proposal — do not apply until implementation is approved)

## ADDED Requirements

### Requirement: 手术 catalog game

WHEN implementation is approved, the registry SHALL include playable `operation` (title 手术, play CTA 开始手术, tag 血腥) with a body hub that exposes four distinct v1 procedures (前臂, 膝, 口腔, 腹). Visual treatment SHALL be graphic lane R (blood, exposed tissue) with a first-run content warning. UNTIL implementation is approved, the registry SHALL NOT list this id.

#### Scenario: Not shipped as a stub

- **WHEN** this change is still a proposal
- **THEN** `getGame('operation')` is undefined

#### Scenario: Warning before graphic play

- **WHEN** a guest opens play without `graphicAck`
- **THEN** the graphic scene is not mounted until they confirm 我已知晓，进入手术
