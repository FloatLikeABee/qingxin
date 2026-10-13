# device-sessions Specification

## Purpose
Lets a linked caregiver (or the user) issue a long-lived, revocable device credential so an elder tablet can stay signed in without sharing a password.

## Requirements

### Requirement: Caregiver link via invite
A user SHALL be able to create a one-time invite code. A different authenticated user SHALL accept that code to become the caregiver. A user SHALL NOT accept their own invite. The pair SHALL appear in `GET /v1/caregiver/links`.

#### Scenario: Link two accounts
- **WHEN** user A creates an invite and user B accepts it
- **THEN** a caregiver link exists with B as caregiver and A as dependent

#### Scenario: Cannot accept own invite
- **WHEN** a user accepts a code they created
- **THEN** the response is 409 or 400 and no link is stored

### Requirement: Issue a device session
A user SHALL be able to issue a device for themselves. A linked caregiver SHALL be able to issue a device for the dependent. An unrelated user SHALL receive 403. The create response SHALL include the opaque `token` once. The stored row SHALL keep only a hash.

#### Scenario: Caregiver issues a device
- **WHEN** a linked caregiver posts a device with the dependent `user_id`
- **THEN** the response is 201 and includes `token`

#### Scenario: Stranger cannot issue
- **WHEN** an unlinked user posts a device for another user id
- **THEN** the response is 403

### Requirement: Device credential authenticates as the target user
`GET /v1/me` SHALL accept `Authorization: Device <token>` and SHALL return the device's `user_id` (the dependent), not the caregiver. Revoking the device SHALL make a later Device request return 401.

#### Scenario: Device token opens the dependent
- **WHEN** the issued device token is sent to `GET /v1/me`
- **THEN** the response user id is the dependent

#### Scenario: Revoked device is rejected
- **WHEN** the issuer deletes the device and the same token is presented
- **THEN** the response is 401
