# Spec Delta

## ADDED Requirements

### Requirement: Export includes finance records
`GET /v1/privacy/export` SHALL include a `finance` object with the caller's categories, transactions (notes decrypted), budgets, subscriptions, challenges and check-ins.

#### Scenario: Export lists the caller's ledger
- **WHEN** an authenticated user who has a transaction calls `GET /v1/privacy/export`
- **THEN** the response is 200 and `finance.transactions` contains that transaction with a plaintext note

### Requirement: Account deletion removes finance rows
`DELETE /v1/privacy/account` MUST delete the user so that no `fin_*` rows remain for that user_id (via foreign-key cascade or an explicit hook).

#### Scenario: Account deleted
- **WHEN** the user deletes their account after creating finance rows
- **THEN** the response is 204 and no fin_transactions, fin_budgets, fin_subscriptions or fin_savings_challenges rows remain for that user
