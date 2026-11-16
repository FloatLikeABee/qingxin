# shangban Specification

## Purpose

Stage 1 of 上班: a guest-playable five-floor company simulation in stylized Three.js. The player walks, rides the elevator, and does distinct work per role. No AI, backend, or login.

## Requirements

### Requirement: Five navigable floors
The play scene SHALL contain five distinct furnished floors named 后勤与物流, 客户与销售, 产品与技术, 人事与财务, and 经营管理, connected by a readable elevator.

#### Scenario: Elevator changes floor
- **WHEN** the player is in the elevator zone and chooses floor 5
- **THEN** after the elevator ride the active floor is 5 and floor 5 stations are interactable

### Requirement: Immediate role roster
The system SHALL expose seven selectable roles: 物流员, 销售顾问, 维修技师, 产品工程师, 财务专员, 运营经理, 总经理. Each SHALL be playable on a fresh guest save. Role switch SHALL cancel the active task, drop carried items, and SHALL NOT teleport the player.

#### Scenario: Fresh save lists every role
- **WHEN** a guest opens 上班 with no save
- **THEN** 换岗 lists all seven roles as enabled controls

### Requirement: Distinct task kinds
Each role SHALL use a different task kind (`sort`, `negotiate`, `repair`, `ship`, `audit`, `allocate`, `decide`) with success and failure outcomes that change personal pay/reputation and department or company meters.

#### Scenario: Wrong sort bay fails
- **WHEN** a 物流员 places a package on a bay that does not match its destination
- **THEN** the task fails and floor 1 workload does not decrease as a success

#### Scenario: CEO decision is not staff allocation
- **WHEN** the player is 总经理 and completes a `decide` task
- **THEN** at least two company meters change and the action is not `moveResource`

### Requirement: Recurring optional work
Work offers for the current role SHALL spawn on simulation time, be accept/decline optional, stay within a live queue of 3, and SHALL NOT deadlock spawning after a decline. A first offer SHALL exist at tick 0.

#### Scenario: Decline does not deadlock
- **WHEN** the player declines the current offer and time advances past the spawn interval
- **THEN** a new offer for the current role appears

### Requirement: Guest save
Progress SHALL persist in `qingxin.shangban` schema 1. Corrupt JSON SHALL recover a playable world without deleting other localStorage keys. Play SHALL work with no session.

#### Scenario: Corrupt save
- **WHEN** the save key contains invalid JSON
- **THEN** the game loads a fresh world with `recovered` true and sibling save keys remain

### Requirement: Pause, clock, NPCs, fallback
The sim SHALL pause when the document is hidden, clamp elapsed ticks, cap NPCs at 12, and expose an interactive DOM fallback when WebGL fails. Stage 1 NPC routines are work/break walking only.

#### Scenario: Hidden tab
- **WHEN** `document.hidden` is true
- **THEN** the simulation does not advance ticks
