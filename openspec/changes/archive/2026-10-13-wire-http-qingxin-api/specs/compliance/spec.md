# Spec Delta

## Purpose

Point login, register, logout, export, and account deletion at the same `QingxinApi` factory that may be HTTP.

## ADDED Requirements

### Requirement: Auth screens use the factory
Login and register SHALL call `getApi()` rather than a concrete mock class. Successful auth SHALL navigate to Settings where the session is visible.

#### Scenario: Register then settings
- **WHEN** a user registers through the UI with the HTTP client selected
- **THEN** Settings shows 已登录 with that display name

## MODIFIED Requirements

### Requirement: Export and delete go through the client
Settings export and account deletion SHALL keep calling `QingxinApi.exportUserData` and `QingxinApi.deleteAccount`, which the HTTP client SHALL implement as `GET /v1/privacy/export` and `DELETE /v1/privacy/account`.

#### Scenario: Delete clears the session
- **WHEN** a logged-in user confirms account deletion
- **THEN** `getSession()` afterwards is `null`
