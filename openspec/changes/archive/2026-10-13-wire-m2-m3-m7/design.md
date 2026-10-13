# Design: wire-m2-m3-m7

## Context

PR #28 (`812a3a2`) added `HttpQingxinApi` implementing `QingxinApi`. Factory: `getApi()` in `web/src/lib/api/client.ts` returns HTTP when `PUBLIC_API_URL` is set. Auth lives in private `#json` / `#raw` / `#refresh` (Bearer). There is **no public `request()`**. CamelCase domain types; snake_case on the wire via `compact()` (drops `undefined`, not `null`).

M2/M3/M7 still use in-memory/localStorage stores. `web/src/lib/finance/api.ts` is an unused second fetch client and must not be revived.

## Real HttpQingxinApi interface (gate 0.1)

Consume, do not fork:

- `QingxinApi` methods are the extension point (`types.ts` comment: add module methods so HTTP and mock stay in sync).
- `HttpQingxinApi` maps bodies with snake_case keys and `compact()`.
- `MockQingxinApi` remains for Vitest and unset `PUBLIC_API_URL`.
- Screens/stores import `getApi` from `client.ts`.

## Findings: web call → OpenAPI (adapted)

Regenerated against `api/openapi.yaml` + handlers after reading `#json`.

### M2 财务

| Web store call | Endpoint | Mismatch |
|---|---|---|
| `hydrate()` IndexedDB | GET `/v1/finance/summary?month`, `/transactions`, `/subscriptions`, `/budgets`, `/challenges` | Never HTTP → empty home for API data |
| `addTransaction({amountFen,type,categoryId,note,occurredOn,clientId})` | POST `/v1/finance/transactions` `FinanceTransactionWrite` | camelCase vs required `amount_fen,category_id,occurred_on,client_id`. `note` is non-nullable string maxLength 200 → omit when empty (not `null`). Salary = income + `fin-cat-inc-salary`. |
| `createSubscription({name,priceFen,cycle,nextBillingDate,remindDaysBefore})` | POST `/v1/finance/subscriptions` `FinanceSubscriptionWrite` | required `price_fen,next_billing_date`; `remind_days_before`; take `annual_cost_fen` from response |
| `upcoming()` | GET `/v1/finance/subscriptions/upcoming` | client-side only |
| `upsertBudget` single object | PUT `/v1/finance/budgets` `FinanceBudgetWrite` `{items:[{category_id,monthly_limit_fen,alert_threshold_pct}]}` | must wrap `items` (handler upserts listed items) |
| `createChallenge` / `checkin` | POST challenges / `{id}/checkins` | `target_days`; omit `target_amount_fen` when unset |
| `summary()` / `report()` local | GET `/summary`, `/report` | use server `income_fen` / `by_category` / `mom` / `yoy` |

### M3 老人助手

| Web | Endpoint | Mismatch |
|---|---|---|
| `loadDemo()` seeds `med-1` 08:00 weekdays, `acked: []` | GET `/v1/elder/today` | Demo seed; modal on first visit |
| reminder `{daysOfWeek,voiceText,time}` | POST `/v1/elder/{elder_id}/reminders` `ElderReminderCreate` | `days_of_week`, `voice_text`, `timezone` (`Asia/Shanghai`); never `schedule_cron`. `elder_id` = `me` or session user id |
| `ack()` forever by id | POST `.../reminders/{id}/ack` `{occurrence_at}` | must be per occurrence/day |
| **Jobs** | POST `/v1/jobs` `CreateJobRequest` | `kind` must be `web_push`; `run_at` RFC3339 with offset; `payload` object with title/body. Reminder create already enqueues jobs server-side; web `createJob` is for ad-hoc pushes using `nextOccurrenceIso` + offset formatter |

### M7 wellness

| Web | Endpoint | Mismatch |
|---|---|---|
| `today(date)` local | GET `/v1/wellness/today` | local totals |
| `addWater(ml, loggedOn)` | POST `/v1/wellness/water` `WellnessWaterWrite` | `ml`, `logged_on` |
| `addSleep({sleepAt,wakeAt,quality,note})` | POST `/v1/wellness/sleep` | `sleep_at`,`wake_at` RFC3339; omit empty `note` |
| `setCycleConsent` | PUT `/v1/wellness/consent` `{cycle_consent}` | local only; cycles 403 until consent |
| `addCycle` | POST `/v1/wellness/cycles` | `start_date`; omit null `end_date`/`flow_level`/`symptoms` |
| `addReport` | POST `/v1/wellness/reports` | `report_date`, `metrics` array; no `file_url` in v1 |
| `createPlan` / `checkin` | POST `/v1/wellness/plans`, `/plans/{id}/checkins` | `kind`, optional `target_days`/`start_date` |
| reminders | POST `/v1/wellness/reminders` `WellnessReminderWrite` | wire field is `time_local` (not `time`) plus `days_of_week` |
| goals | GET/PUT `/v1/wellness/goals` | local 2000 ml default; server defaults too |

## Modal root cause (该吃药了)

`routes/elder/+page.svelte` treats any reminder whose id is missing from `acked[]` as due, and `loadDemo()` seeds `med-1` with empty `acked`. No weekday, clock, or date check. `dismissible={false}` blocks the page. `acked` is forever, so one tap hides the dose forever.

Fix: `isDue(reminder, now, ackedTodayIds)` =

1. Asia/Shanghai ISO weekday (1=Mon…7=Sun) ∈ `days_of_week`
2. today's `HH:MM` ≥ reminder `time`
3. elapsed minutes ≤ 60 (same grace as `MISS_GRACE_MINUTES`)
4. reminder id not in today's confirmation set

Source of truth: `GET /v1/elder/today` (reminders + disclaimer). Client re-checks every 60s. Ack POSTs `occurrence_at` for today's dose and records `(reminderId, shanghaiDate)` locally so a refresh stays closed. Remove demo seed.

Unit clock: Mon 07:00 closed; Mon 08:05 open; Sat 08:05 closed; acked today closed; yesterday ack + Mon 08:05 open; Mon 09:05 (65 min) closed.

## Architecture

```
pages → getFinanceStore / getElderStore / getWellnessStore
      → getApi()  (QingxinApi)
           ├─ HttpQingxinApi  PUBLIC_API_URL set  → /v1 snake_case
           └─ MockQingxinApi  tests / unset URL
payload builders in lib/{finance,elder,wellness}/payload.ts
  used by HttpQingxinApi and contract tests
IndexedDB records cache + sync outbox (existing offline helpers)
```

Payload builders return JSON with no `undefined`/`null` optionals. `HttpQingxinApi` sends them through `#json`. Mock keeps camelCase domain objects for screens.

Elder `elder_id`: `me` on today and self-service writes (session user). Caregiver remote configure stays on family page using the same session (T1 link already required by API).

Device `Authorization: Device` is not on `#raw` (Bearer only). Care pages work with the logged-in elder or caregiver Bearer token. Tablet Device auth is a follow-up on Quill's client, not this change.

## Self-grill (Superpowers): alternatives

1. **Extend `QingxinApi` + implement on `HttpQingxinApi` / `MockQingxinApi`; rune stores call `getApi()` (chosen).** Matches PR #28's extension point, reuses `#json`/refresh/`compact`, one auth path. Cost: more methods on the shared interface (additive; grouped so M6/M8 can append pets/study similarly).

2. **Per-module adapters calling a leaked `request()` (draft default).** Rejected as primary: `#json` is private; exposing a second fetch (old `finance/api.ts`) forks auth and token refresh. Keep only pure payload mappers in module files.

3. **Generate `openapi-typescript` + `openapi-fetch` as the runtime client.** Strong compile-time casing. Rejected as runtime: would replace Quill's client. Partial keep: Vitest uses `ajv` against `components.schemas` from `api/openapi.yaml`.

4. **Keep local stores and background-sync.** Double source of truth and conflict logic. Rejected; IndexedDB is cache/outbox only (`client_id` already makes transactions idempotent).

5. **Switch Axum to camelCase (`rename_all`).** One-line server change. Rejected: breaks the published OpenAPI other modules already target.

6. **Only implement HTTP and skip Mock.** Rejected: `QingxinApi` would not compile; unit tests need a mock.

Grill: 401 mid-write → existing refresh then retry; still 401 → `ApiError` and pages keep cached snapshot. Offline → show last snapshot, enqueue write. Reminder jobs → prefer server enqueue on POST reminder; web `createJob` for explicit ad-hoc push with correct shape.

## File ownership

Touch: `web/src/lib/api/*` (additive methods), `web/src/lib/finance/*`, `web/src/lib/elder/*`, `web/src/lib/wellness/*`, those routes, `OfflineBanner.svelte` (new outbox types), e2e/CI shared config.

Do **not** edit `web/src/lib/pets/**`, `web/src/lib/study/**`, or pets/study routes.

## Testing

- Contract: Vitest helper loads `api/openapi.yaml`, compiles `components.schemas.*` with ajv+formats, asserts every write mapper (transactions, subscriptions, budgets, challenges, reminder, ack, job, water, sleep, consent, cycle, report, plan, wellness reminder).
- HttpQingxinApi stub-fetch tests: salary body, subscription body, `{items:[]}` budgets, job shape, omitted nulls.
- `isDue` unit tests (clock cases above).
- Store tests: mock login + `resetApi`; idempotent `client_id`; challenge double check-in; consent gate.
- E2E (`test:e2e:api`, existing CI job): register → income 工资 → home shows it; add subscription; POST `/v1/jobs` via client helper against live API; elder reminder via API + modal closed before time; wellness +1 cup.

## Risks

- Merge conflict with M6/M8 on `types.ts` / `http.ts` / `mock.ts` / `OfflineBanner.svelte`. Keep new methods in a trailing grouped block.
- PUT budgets upserts listed items (does not delete omitted ones). Sending `{ items: [one] }` is correct for "add/update this budget".
- Wellness reminder write field is `time_local`; response field is `time`.
