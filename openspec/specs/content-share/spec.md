# content-share Specification

## Purpose
Help users turn a Qingxin draft into text they can publish on 小红书, 微信, 抖音, and 公众号 using official browser share and export tools only.

## Requirements

### Requirement: Platform packs
The system SHALL format a share pack per target with title and body. 小红书 and 抖音 packs SHALL include hash-tags. 微信 and 公众号 packs SHALL be article-like text without requiring unofficial APIs.

#### Scenario: Xiaohongshu pack includes hashtags
- **WHEN** a user formats a 小红书 pack with tags `种菜` and `生活`
- **THEN** the share text contains the title, body, and `#种菜`

### Requirement: Official share only
The system SHALL attempt the Web Share API when `navigator.share` exists, and SHALL fall back to clipboard copy. It SHALL NOT call unofficial, scraped, or credential-based publisher endpoints.

#### Scenario: Clipboard fallback
- **WHEN** Web Share is unavailable
- **THEN** the pack text is written to the clipboard and the method is `clipboard`

### Requirement: Export remains available
Markdown and PPTX export SHALL remain available for drafts that are not shared through the system sheet.
