## 0. Gate

- [x] 0.1 Confirm HttpQingxinApi (`812a3a2`) is on the branch; read `QingxinApi` / `#json` / `compact`; no public `request()`
- [x] 0.2 Propose this change from the draft adapted to that interface; Superpowers self-grill in design.md; `openspec validate --strict`

## 1. Contract harness and payload mappers (tests first)

- [x] 1.1 Add ajv, ajv-formats, yaml devDependencies; `web/src/lib/api/contract.ts` validating a body against `components.schemas.<Name>` in `api/openapi.yaml`
- [x] 1.2 Write failing tests for finance/elder/wellness/job write mappers (salary tx, omit empty note, subscription, budgets `{items:[]}`, challenge omit target, reminder no cron, ack `occurrence_at`, job `web_push` + offset `run_at` + payload title/body, water/sleep/consent/cycle/report/plan, wellness `time_local`)
- [x] 1.3 Implement `web/src/lib/{finance,elder,wellness}/payload.ts` until contract tests pass
- [x] 1.4 Write failing `isDue` tests (Mon 07:00 closed, Mon 08:05 open, Sat closed, acked today closed, acked yesterday open, 65 min closed); implement `web/src/lib/elder/due.ts`

## 2. QingxinApi + HttpQingxinApi + Mock (tests first)

- [x] 2.1 Add finance, elder, wellness, and `createJob` methods to `QingxinApi` in `types.ts`
- [x] 2.2 Write failing `http.spec.ts` cases that stub fetch and assert snake_case paths/bodies for salary, subscription, budgets, job, elder reminder, water
- [x] 2.3 Implement methods on `HttpQingxinApi` using payload mappers and `#json`
- [x] 2.4 Implement the same methods on `MockQingxinApi` (in-memory, login required, idempotent finance `client_id`, cycle consent gate)

## 3. Stores and pages

- [x] 3.1 Rewrite finance store to call `getApi()`; load summary/subscriptions/challenges on hydrate; optimistic write + IndexedDB cache; put budgets as `{items}`; take annual cost from API
- [x] 3.2 Rewrite wellness store to call `getApi()`; today/water/sleep/consent/cycles/reports/plans from API; omit empty notes
- [x] 3.3 Replace elder demo seed with an API store: `GET /v1/elder/today`, per-day ack map, `isDue` + 60s tick; family page creates reminders through `getApi()`
- [x] 3.4 Update finance, elder, wellness routes to the new stores; delete unused `finance/api.ts` fetch client
- [x] 3.5 Drain new outbox types in `OfflineBanner.svelte` (`finance_transaction_create`, `wellness_water_create`, `elder_reminder_ack`)

## 4. E2E and CI

- [x] 4.1 Extend `web/e2e/api.e2e.ts` (or sibling matched by `playwright.api.config.ts`): register → salary income → finance home shows 工资; add subscription; live `POST /v1/jobs` with web payload helper succeeds; wellness +1 cup; elder reminder does not open 该吃药了 before dose time
- [x] 4.2 Keep using the existing `qingxin.yml` e2e job (api + web + `npm run test:e2e:api`)

## 5. Ship

- [x] 5.1 `npm test`, `npm run check`, `npm run build` in `web/`
- [x] 5.2 `/opsx-archive` after apply; open a ready PR against main that Refs #27. Never merge, force-push, or rewrite history
