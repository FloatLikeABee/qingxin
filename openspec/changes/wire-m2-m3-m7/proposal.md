# Proposal

## Why

M2 finance, M3 elder/care, and M7 wellness still read local stores (`MemoryFinanceStore`, `lib/elder/demo.ts`, `MemoryWellnessStore`). Quill's `HttpQingxinApi` (PR #28 / `812a3a2`) now calls `/v1` for auth and other modules, so API-seeded salary never appears on the finance page, camelCase/`null` bodies are rejected, budgets are not `{ items: [] }`, push jobs are not `web_push` with RFC3339 `run_at` and `payload.title/body`, and the care page opens 该吃药了 from a demo seed instead of a due dose.

## What Changes

- Extend `QingxinApi` with finance, elder, wellness, and job methods. Implement them on `HttpQingxinApi` (snake_case OpenAPI bodies via existing `#json` / `compact` / refresh) and `MockQingxinApi` (unit tests). Do not add a second fetch client or fork auth.
- Replace local module stores with API-backed rune stores that load on mount, write through `getApi()`, cache snapshots in IndexedDB, and enqueue offline outbox ops.
- Fix write payloads: omit empty/null optionals, wrap budgets as `{ items: [...] }`, jobs `kind: "web_push"` with offset `run_at` and title/body in `payload`.
- Care 该吃药了 modal: `GET /v1/elder/today`, due only when scheduled today (Asia/Shanghai weekday), time has passed, within 60 min grace, and not confirmed today. Remove the demo seed.
- Contract tests against `api/openapi.yaml` schemas and Playwright E2E against a live API in the existing `qingxin.yml` e2e job.
- Do not edit pets/study module files except shared API/offline/CI surfaces this change must touch.

## Capabilities

### New Capabilities

- None. Behavior belongs on existing capabilities.

### Modified Capabilities

- `api-client`: typed finance, elder, wellness, and job methods on `QingxinApi` / `HttpQingxinApi` / `MockQingxinApi`; snake_case bodies that match OpenAPI write schemas.
- `qingxin-finance`: finance screens load and persist through `/v1/finance/*`.
- `elder-assistant`: care home uses `/v1/elder/today`; modal due rules; per-day ack; no demo seed.
- `qingxin-wellness`: wellness screens load and persist through `/v1/wellness/*`.
- `offline-pwa`: IndexedDB cache and outbox for finance, elder, and wellness writes.

## Impact

- `web/src/lib/api/{types,http,mock,client}.ts`, `web/src/lib/{finance,elder,wellness}/*`, `web/src/routes/{finance,elder,wellness}/*`, `OfflineBanner.svelte`, contract tests, `web/e2e/api.e2e.ts`, Playwright API config.
- No Axum route changes expected. OpenAPI remains the contract.
- Shared files also needed by an M6/M8 wiring agent: keep additive methods grouped; do not edit `web/src/lib/pets/**`, `web/src/lib/study/**`, or those routes.
- Refs #27. Do not merge the PR.
