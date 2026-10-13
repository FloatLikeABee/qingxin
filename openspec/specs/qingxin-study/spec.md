# qingxin-study Specification

## Purpose
Gives an authenticated Qingxin user a private study habit toolkit: 7/14/21-day challenges with derived streaks, text flashcards with simple spaced review, encrypted Markdown notes searchable by title and tags, a user-built skill tree with optional templates, missed-day and review reminders, and a browser-only focus timer, without community features or file storage.

## Requirements

### Requirement: Owner isolation
Study endpoints MUST derive the owner from the T1 AuthUser JWT or device session and MUST NOT expose or modify another user's data. Other users' ids MUST return 404. Missing or invalid tokens MUST return 401.

#### Scenario: Other user's challenge
- **WHEN** user A requests or checks in on a challenge id owned by user B
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a request has no valid access token
- **THEN** the API responds 401 with error code unauthenticated

### Requirement: Caregivers never see study data
A linked caregiver MUST NOT read or write the dependent's study records. Study routes MUST NOT accept an elder_id override.

#### Scenario: Caregiver cannot fetch dependent challenge
- **WHEN** caregiver C is linked to user E and C requests E's challenge id
- **THEN** the API responds 404 and C's GET /v1/study/today shows only C's challenges

### Requirement: Challenge length is 7, 14 or 21 days
POST /v1/study/challenges MUST accept target_days of 7, 14 or 21 and MUST reject other values with 400. Name is required. Timezone defaults to Asia/Shanghai and MAY be UTC.

#### Scenario: 21-day challenge created
- **WHEN** the user POSTs name 背单词 and target_days 21
- **THEN** a challenge is stored with those fields and timezone Asia/Shanghai

#### Scenario: Invalid length rejected
- **WHEN** the user POSTs target_days 30
- **THEN** the API responds 400 with the T1 error envelope and nothing is stored

### Requirement: Check-in is idempotent per local day
The system SHALL store at most one check-in per challenge per local calendar day in the challenge timezone. Repeat POST of the same day MUST return 200 with the existing row. current_streak MUST be derived from consecutive check-in dates, not stored.

#### Scenario: Double check-in same day
- **WHEN** the user checks in twice on the same local day
- **THEN** the second response is 200 with the same row id and current_streak is unchanged

#### Scenario: Consecutive days in Shanghai
- **WHEN** a Asia/Shanghai challenge has check-ins on 2026-10-11, 2026-10-12 and 2026-10-13 and today in that timezone is 2026-10-13
- **THEN** current_streak is 3

#### Scenario: Gap resets streak
- **WHEN** a challenge has check-ins on 2026-10-10 and 2026-10-13 and today is 2026-10-13
- **THEN** current_streak is 1

#### Scenario: Timezone date key
- **WHEN** a UTC challenge and a Asia/Shanghai challenge both receive a check-in with an explicit day
- **THEN** each stores that day independently and does not rewrite it into the other timezone

### Requirement: Streak reminder skips completed days
Active missed-day reminders MUST enqueue T1 scheduled_jobs of kind web_push with payload type study.streak. When scheduler tick_once runs a due study.streak job, if the owner already has a check-in on that local day, the job MUST complete without recording a PushMessage. If they have not checked in, PushSender MUST record a message.

#### Scenario: Already checked in
- **WHEN** the user checked in before the due study.streak job fires
- **THEN** no PushMessage is recorded for that job

#### Scenario: Missed day still notifies
- **WHEN** a due study.streak job fires and the user has no check-in that local day
- **THEN** PushSender records a message whose payload type is study.streak

### Requirement: Flashcard review scheduling
Grading a card MUST update ease, interval_days and next_review_date using SM-2-lite. New cards start at ease 2.5 and interval_days 0. A good grade at interval 1 MUST set interval_days greater than 1 and move next_review_date forward. Front and back MUST be encrypted at rest. POST /v1/study/flashcards/classify SHALL call AiGateway; unconfigured AI MUST return 501 ai_unconfigured. The user MAY override category on create. Photo or file_url bodies MUST be rejected.

#### Scenario: Good grade advances interval
- **WHEN** a card with interval_days 1 is graded good
- **THEN** interval_days is greater than 1 and next_review_date is after today

#### Scenario: Front ciphertext is not plaintext
- **WHEN** a user creates a flashcard with front 过去分词
- **THEN** the study_flashcards row stores a non-empty front_encrypted blob that is not the UTF-8 bytes of 过去分词
- **AND** a later GET of that card returns front 过去分词

#### Scenario: Classify uses the gateway stub
- **WHEN** the user POSTs classify text and the gateway returns 英语
- **THEN** the response includes category 英语 and the study disclaimer

#### Scenario: Photo capture rejected
- **WHEN** a client POSTs a flashcard with file_url
- **THEN** the API responds 400 and no row is stored

### Requirement: Notes are encrypted Markdown with metadata search
Study notes MUST store title and tags in plaintext and content_md only as AES-256-GCM. GET /v1/study/notes?q= MUST match title or tags and MUST NOT require decrypting every body. Notes MUST live in study_notes, not mood or wellness tables.

#### Scenario: Body ciphertext is not plaintext
- **WHEN** a user creates a note with content_md # 摘要
- **THEN** the study_notes row stores a non-empty content_md_encrypted blob that is not the UTF-8 bytes of that Markdown
- **AND** a later GET of that note returns the plaintext Markdown

#### Scenario: Search title and tags only
- **WHEN** the user has a note titled 动词 whose tags include 语法 and body contains 秘密句子
- **THEN** q=动词 and q=语法 return that note
- **AND** q=秘密句子 returns an empty list

### Requirement: Skill tree is user-built with optional templates
The system SHALL let the owner create, parent, reorder, unlock and delete skill nodes. GET /v1/study/skills/templates MUST return built-in templates. POST /v1/study/skills/from-template MUST copy a template into the caller's tree.

#### Scenario: Copy English template
- **WHEN** the user POSTs from-template with the 英语词汇 template id
- **THEN** skill nodes for that user exist and list returns them as unlocked or locked according to the template

#### Scenario: Custom node
- **WHEN** the user POSTs a root node titled 即兴伴奏
- **THEN** the node is stored for that user with parent_id null

### Requirement: Focus timer is browser only
The web focus page MUST run a pomodoro-style timer and optional white noise in the browser. The API MUST NOT expose focus session resources.

#### Scenario: No focus API
- **WHEN** a client calls POST /v1/study/focus
- **THEN** the API responds 404

### Requirement: Not-instruction-advice text is always shown
Home/today, classify, and study pages MUST include the fixed disclaimer that this module is a habit tool, not teaching or counselling.

#### Scenario: Today includes disclaimer
- **WHEN** an authenticated user calls GET /v1/study/today
- **THEN** the body contains disclaimer 本模块为学习习惯记录工具，不构成教学辅导或心理咨询。

### Requirement: Elder tokens inherited
Study pages MUST size text and contrast using the global `--qx-font-size` and document contrast tokens. They MUST NOT introduce a module-local elder-mode setting or hard-coded font sizes and colours.

#### Scenario: Global text size
- **WHEN** the document root sets --qx-font-size to 1.25rem
- **THEN** study page copy inherits that size through rem-based styles
