# Proposal

## Why

`MemoryPetsStore` and `MemoryStudyStore` are non-reactive in-memory classes. Pets and study pages never call `/v1`, so they stay empty, and adding a pet mutates a plain array so `{#if store.pets.length === 0}` never leaves the empty form. Quill's `HttpQingxinApi` (merged as `812a3a2`) now owns auth, token refresh, and snake_case mapping; M6 and M8 must consume that client instead of a second HTTP stack.

## What Changes

- Extend `QingxinApi` with typed pets and study methods. Implement them on `HttpQingxinApi` (shared `#json` + session) and `MockQingxinApi` (unit tests / unset `PUBLIC_API_URL`).
- Add `web/src/lib/{pets,study}/http.ts` payload builders that emit OpenAPI snake_case (`avatar_url`, `next_due_date`, `measured_on`, `weight_g`, `content_md`, `parent_id`, `target_days`) and omit empty/null fields rather than sending `null`.
- Rewrite pets and study stores as `$state` rune classes that load from `getApi()`, stay reactive, and cache via `lib/offline`.
- Skill templates and flashcard review grades come from the server (`GET /v1/study/skills/templates`, `POST .../review` with `again|hard|good|easy`). Challenge `target_days` is only 7, 14, or 21.
- Contract tests validate every M6/M8 write body against `api/openapi.yaml`. Playwright E2E against a live Axum process covers add-pet persistence and study check-in streak.

## Capabilities

### New Capabilities

- None. Pets and study already exist as API + UI; this change wires the UI to the existing contract.

### Modified Capabilities

- `api-client`: `QingxinApi` / `HttpQingxinApi` / `MockQingxinApi` cover M6 pets and M8 study operations with OpenAPI snake_case bodies.
- `qingxin-pets`: The pets web app SHALL read and write through that client with reactive stores so adding a pet saves and API data appears.
- `qingxin-study`: The study web app SHALL read and write through that client; templates and review grades come from the server; `target_days` is 7, 14, or 21.

## Impact

- `web/src/lib/api/{types,http,mock}.ts` (append pets/study methods; do not rewrite auth).
- `web/src/lib/pets/*`, `web/src/lib/study/*`, `web/src/routes/pets/*`, `web/src/routes/study/*` except chrome already shared with #28.
- New contract helper + Vitest; `web/e2e/pets-study.e2e.ts` picked up by existing `test:e2e:api` / CI `e2e` job.
- No Axum or OpenAPI edits expected.
- Do not touch finance, wellness, or elder module files owned by the parallel M2/M3/M7 wiring work, except the shared API types/client this change must extend.
- Do not merge the PR (PO merges).
