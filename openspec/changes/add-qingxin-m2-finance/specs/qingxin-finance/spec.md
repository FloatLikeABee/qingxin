# Spec Delta

## Purpose

Gives an authenticated Qingxin user a CNY-only personal ledger: three-step bookkeeping, monthly overview, budgets, subscription reminders, and manual savings challenges, without financial advice.

## ADDED Requirements

### Requirement: Quick transaction entry
The system SHALL let an authenticated user record a CNY income or expense as a positive integer fen amount, a category whose kind matches the type, and an optional note of at most 200 characters, in three steps (amount, category, confirm).

#### Scenario: Expense recorded in three steps
- **WHEN** the user enters 25.50, taps 餐饮 and confirms
- **THEN** a transaction with amount_fen 2550, type expense, category 餐饮 and currency CNY is stored for that user
- **AND** the user returns to the finance home with the new entry visible

#### Scenario: Invalid amount rejected
- **WHEN** a client posts amount_fen 0 or a negative value
- **THEN** the API responds 400 with the T1 error envelope and nothing is stored

### Requirement: Idempotent offline sync
The system SHALL accept a client-generated client_id on transaction creation and MUST treat a repeat of the same client_id for the same user as the same transaction.

#### Scenario: Offline entry synced once
- **WHEN** the user records an expense offline and the outbox retries it twice after reconnecting
- **THEN** exactly one transaction exists on the server

### Requirement: Owner isolation
Finance endpoints MUST derive the owner from the T1 AuthUser JWT or device session and MUST NOT expose or modify another user's data. Other users' ids MUST return 404. Missing or invalid tokens MUST return 401.

#### Scenario: Other user's transaction
- **WHEN** user A requests or edits a transaction id owned by user B
- **THEN** the API responds 404

#### Scenario: Unauthenticated request
- **WHEN** a request has no valid access token
- **THEN** the API responds 401 with error code unauthenticated

### Requirement: Monthly summary
The system SHALL return for a requested YYYY-MM month the CNY income, expense, balance, totals by category, budget progress (spent, percent, alert), and the five most recent transactions, using occurred_on date strings.

#### Scenario: Summary with budget alert
- **WHEN** the user's 餐饮 budget is 1000 yuan with threshold 80 and they have spent 850 yuan this month
- **THEN** the summary shows 餐饮 at 85 percent with alert true

### Requirement: Trend report
The system SHALL report category shares and month-over-month and year-over-year expense changes for a requested month range. The report page SHALL show 仅为记账工具，不构成理财建议.

#### Scenario: Month over month
- **WHEN** the user opens the report for 2026-10
- **THEN** expense change versus 2026-09 and versus 2025-10 is shown
- **AND** the text 仅为记账工具，不构成理财建议 is visible

### Requirement: Subscription management
The system SHALL store CNY subscriptions with price_fen, cycle and next_billing_date, compute an annualised fen cost, list items due within their reminder window, and roll next_billing_date forward after it passes.

#### Scenario: Upcoming renewal
- **WHEN** a monthly subscription of 30 yuan bills in 2 days and remind_days_before is 3
- **THEN** it appears in the upcoming list and its annual cost is 360 yuan

#### Scenario: Date roll-forward
- **WHEN** the next billing date of a monthly subscription has passed
- **THEN** the system advances it by one cycle

### Requirement: Subscription reminders
The system SHALL show due renewals in-app and MUST enqueue a T1 scheduled_jobs web_push job for each active subscription so Web Push can fire where supported.

#### Scenario: Reminder job scheduled
- **WHEN** the user creates an active subscription with a future next_billing_date
- **THEN** a pending scheduled job exists for that user whose payload identifies the subscription

### Requirement: Savings challenges
The system SHALL let the user create a challenge with a name and target days and check in at most once per day. Check-ins are manual and MUST NOT auto-fail from logged expenses.

#### Scenario: Double check-in
- **WHEN** the user checks in twice on the same day
- **THEN** one check-in is stored and progress increases by one day

### Requirement: CNY only
Finance amounts MUST be integer fen of CNY. The API MUST NOT accept another currency code.

#### Scenario: Responses declare CNY
- **WHEN** a client lists transactions or a summary
- **THEN** each money object uses currency CNY

### Requirement: Expense red and income green
Finance pages MUST style expenses with the red token and income with the green token in both light and dark appearance.

#### Scenario: Home recent list
- **WHEN** the home page shows an expense and an income
- **THEN** the expense amount uses the expense (red) token and the income amount uses the income (green) token

### Requirement: Elder tokens inherited
Finance pages MUST size text and contrast using the global `--qx-font-size` and document contrast tokens. They MUST NOT introduce a module-local elder-mode setting.

#### Scenario: Global text size
- **WHEN** the document root sets --qx-font-size to 1.25rem
- **THEN** finance page copy inherits that size through rem-based styles
