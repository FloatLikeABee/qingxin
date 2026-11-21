# retired-modules Specification

## Purpose

Remove 本地生活, AI效率工具箱, 学习打卡, and 求职副业 from live product surfaces without destroying stored data or archival code.

## Requirements

### Requirement: No live entries

The module hub, home, primary nav, recommendations, and pets nearby-services CTA SHALL NOT offer those four modules as destinations to play.

#### Scenario: Hub omits retired names

- **WHEN** a guest opens `/modules`
- **THEN** headings 本地生活, AI效率工具箱, 学习打卡, and 求职副业 are absent, and 积木台 is present

### Requirement: Safe deep links

`/modules/local`, `/modules/ai`, `/modules/hustle`, and `/modules/study` SHALL render a retired notice without mounting the old interactive UI. `/study` and `/study/*` SHALL redirect to `/modules/study`.

#### Scenario: Old local URL

- **WHEN** a guest opens `/modules/local`
- **THEN** the page says the module was withdrawn and offers 返回模块中心, and the map/list toggle is absent

### Requirement: Data stays

The change SHALL NOT delete localStorage/IndexedDB keys or drop API helpers for the four modules.

#### Scenario: Sibling keys

- **WHEN** 积木台 recovers a corrupt save
- **THEN** hustle/study/garden/shangban keys are still present
