## ADDED Requirements

### Requirement: Finance pages use the real API
Finance screens SHALL read summary, recent transactions, budgets, subscriptions, and challenges through `QingxinApi` (HTTP when `PUBLIC_API_URL` is set) so data created via `/v1/finance` appears after load.

#### Scenario: API-seeded transaction appears
- **WHEN** a salary income transaction is created via POST `/v1/finance/transactions`
- **THEN** the finance home shows it in the balance and recent list after load

#### Scenario: Subscription payload accepted
- **WHEN** the user adds a subscription in settings
- **THEN** the request body validates against `FinanceSubscriptionWrite` and the API returns 201
