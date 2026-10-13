# Spec Delta

## Purpose

Makes 轻心 installable and usable offline by caching the app shell and key data, then silently syncing when the network returns.

## ADDED Requirements

### Requirement: Web app manifest
The system SHALL publish a web manifest with name 轻心, icons, and a theme color so the app is installable (添加到主屏幕).

#### Scenario: Manifest identity
- **WHEN** a client fetches the web manifest
- **THEN** it includes name 轻心, at least one icon, and a theme_color

### Requirement: Offline app shell
The system SHALL register a service worker that caches the app shell and serves an offline fallback page when a navigation cannot be fulfilled from cache or network.

#### Scenario: Offline navigation fallback
- **WHEN** the user is offline and opens a route that is not in the shell cache
- **THEN** the service worker serves the offline fallback page

### Requirement: IndexedDB cache
The system SHALL persist key JSON records in IndexedDB so cached content can be shown while offline.

#### Scenario: Read after write
- **WHEN** a record is stored under a key and later read by that key
- **THEN** the stored value is returned

### Requirement: Silent re-sync
The system SHALL queue failed mutations while offline and drain that queue silently when connectivity returns, without requiring a full-page reload.

#### Scenario: Drain after reconnect
- **WHEN** a mutation is queued offline and the browser reports online
- **THEN** the queue is processed in order and the processed items are removed

### Requirement: Offline notice
The system SHALL show a visible banner or notice while the browser is offline and SHALL hide it after reconnect.

#### Scenario: Offline banner
- **WHEN** `navigator.onLine` is false
- **THEN** the user sees an offline notice in zh-CN
