# compliance Specification

## Purpose
Enforces first-run privacy consent, non-advice disclaimers, and settings entry points for data export and account deletion.

## Requirements

### Requirement: First-run privacy consent
The system SHALL show a privacy-policy modal on first launch and SHALL not treat the session as consented until the user accepts. Consent SHALL persist so returning users are not prompted again.

#### Scenario: First visit
- **WHEN** a user opens the app with no stored consent
- **THEN** a privacy-policy modal is shown and cannot be dismissed without an explicit accept or reject action

#### Scenario: Returning consented user
- **WHEN** a user who previously accepted the privacy policy opens the app
- **THEN** the privacy modal is not shown automatically

### Requirement: Tool-only disclaimer
The system SHALL display a disclaimer that Qingxin does not provide medical diagnosis, financial advice, or legal counsel, and that content is tool assistance and information display only.

#### Scenario: Disclaimer visible
- **WHEN** a user views the privacy modal or settings
- **THEN** the non-medical / non-financial / non-legal disclaimer is visible

### Requirement: Auth screens
The system SHALL provide login and register screens that collect credentials through the typed API client and show validation feedback.

#### Scenario: Login submit
- **WHEN** a user submits valid credentials on the login screen
- **THEN** the API client login method is invoked and a success session is stored

### Requirement: Auth screens use the factory
Login and register SHALL call `getApi()` rather than a concrete mock class. Successful auth SHALL navigate to Settings where the session is visible.

#### Scenario: Register then settings
- **WHEN** a user registers through the UI with the HTTP client selected
- **THEN** Settings shows 已登录 with that display name

### Requirement: Settings data controls
The settings page SHALL let the user change theme mode and SHALL expose data-export and account-deletion actions that go through the API client.

#### Scenario: Export entry
- **WHEN** a consented user opens settings and chooses export
- **THEN** the API client export method is invoked and a downloadable payload is produced

### Requirement: Export and delete go through the client
Settings export and account deletion SHALL keep calling `QingxinApi.exportUserData` and `QingxinApi.deleteAccount`, which the HTTP client SHALL implement as `GET /v1/privacy/export` and `DELETE /v1/privacy/account`.

#### Scenario: Delete clears the session
- **WHEN** a logged-in user confirms account deletion
- **THEN** `getSession()` afterwards is `null`
