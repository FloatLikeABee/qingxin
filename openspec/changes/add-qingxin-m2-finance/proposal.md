# Proposal

## Why

Issue #7 (M2 个人财务小助手) needs a personal ledger so users can answer “钱花哪了 / 如何存钱” after T1 (`api/`) and T2 (`web/`) merged. The draft OpenSpec assumed `qingxin/server` and `qingxin/web`; this change maps it onto the live tree and locks PO decisions (CNY, encrypted notes, no voice, manual challenges, in-app + Web Push reminders).

## What Changes

- Additive SQLx migration `api/migrations/0002_finance.sql` for `fin_categories`, `fin_transactions`, `fin_budgets`, `fin_subscriptions`, `fin_savings_challenges`, `fin_challenge_checkins`. Amounts are integer fen; currency is CNY only.
- Axum finance module mounted at `/v1/finance/*` behind T1 `AuthUser`. Cross-user ids return 404; missing tokens return 401 `unauthenticated`.
- Transaction notes stored with T1 `FieldCrypto` AES-256-GCM. Amounts stay plaintext fen so SQL can SUM.
- Monthly summary, category/month report (MoM/YoY), budgets with alert threshold, subscriptions with annualised cost and `next_billing_date` roll-forward.
- Subscription renewal reminders: in-app upcoming list plus `scheduled_jobs` / `PushSender` Web Push when a subscription is stored.
- Savings challenges with manual daily check-ins (idempotent per day).
- Privacy export includes decrypted finance records; account delete cascades `fin_*` rows.
- SvelteKit routes under `web/src/routes/finance/` using Quill kit components and T2 IndexedDB outbox. Red = expense, green = income. Pages inherit global text-size and contrast tokens. No voice bookkeeping. AI stays unused except through `AiGateway` if a later insight is added (v1 has no insight call).
- Extend `api/openapi.yaml` with the finance contract.

## Capabilities

### New Capabilities

- `qingxin-finance`: owner-scoped personal ledger, CNY budgets, subscription reminders, manual savings challenges, monthly report, and finance privacy hooks.

### Modified Capabilities

- `privacy`: JSON export MUST include the caller's finance records; account deletion MUST leave no `fin_*` rows.
- `field-encryption`: finance transaction notes MUST be AES-256-GCM at rest (amounts remain plaintext fen).

## Impact

- Code: new `api/src/finance/` and `api/tests/finance.rs`; small mounts in `api/src/lib.rs`, `api/src/routes.rs` (export hook + router merge), and `api/src/scheduler.rs` (reminder maintenance tick).
- Web: new `web/src/lib/finance/` and `web/src/routes/finance/`; `web/src/routes/modules/finance/` redirect only. No T2 tab or theme-token rewrite.
- Contract: `api/openapi.yaml` Finance tag and `ExportPayload.finance`.
- CI: existing `.github/workflows/qingxin.yml` (`api/**`, `web/**`).
- Parallel M3: keep shared-file hunks minimal.
