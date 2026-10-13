# Design

## Context

`812a3a2` landed `HttpQingxinApi` implementing `QingxinApi`. Factory: `getApi()` in `web/src/lib/api/client.ts` returns HTTP when `PUBLIC_API_URL` is set, else `MockQingxinApi`. Auth, Bearer, 401 refresh, `ApiError`, and snake_case mapping live there. `#json(method, path, { json?, auth? })` is **private**. There is no public `request<T>()`. `compact()` drops `undefined` but **keeps `null`**.

M6/M8 screens still call `MemoryPetsStore` / `MemoryStudyStore` (plain class fields). Pets home `{#if store.pets.length === 0}` never tracks mutations; `selected` stays `0` after the first add so Svelte may not re-render. `today()` is computed locally and never hits `GET /v1/pets/today` or `GET /v1/study/today`.

M2/M3/M7 wiring owns finance/wellness/elder. This change must not edit those trees. Shared files that must be touched: `types.ts`, `http.ts`, `mock.ts` (append-only methods).

## Goals / Non-Goals

**Goals:**

- Pets and study round-trip `/v1` through `getApi()` with `$state` stores.
- Wire bodies match `api/openapi.yaml` (snake_case; omit empty/null optionals; `target_days` ∈ {7,14,21}; review grade enum; templates from server).
- Contract tests + live-API Playwright in the existing CI `e2e` job.

**Non-Goals:**

- Changing Axum or OpenAPI.
- Public generic `request()` on `HttpQingxinApi`.
- Wiring finance, wellness, or elder.
- File uploads, family-shared pets, lock-phone focus timer, AI care-tip UI (501 stub stays unused).
- Merging the PR.

## Findings: web call → OpenAPI (regenerated against `components.schemas`)

### M6 宠物

| Store / UI | Endpoint | Schema | Mismatch vs current web |
|---|---|---|---|
| `today()` local | GET `/v1/pets/today` | `PetsToday` | never called → empty page |
| `createPet({name,species,breed,birthday,avatarUrl})` | POST `/v1/pets` | `PetWrite` required `[name,species]`; optionals `breed`, `birthday`, `avatar_url` are **non-nullable strings** | camelCase `avatarUrl`; nulls would fail schema — omit empties |
| `pet(id)` | GET `/v1/pets/{id}` | `Pet` | local only |
| `addLog({type,value})` | POST `/v1/pets/{id}/logs` | `PetLogWrite` required `[type]`; optional `value`, `logged_at` | omit empty `value`; `logged_at` server-side |
| `addRecord({type,date,nextDueDate,note})` | POST `/v1/pets/{id}/records` | `PetRecordWrite` required `[type,date]`; `next_due_date`, `note` | camelCase; omit nulls |
| `addWeight({measuredOn,weightG})` | POST `/v1/pets/{id}/weights` | `PetWeightWrite` required `[measured_on,weight_g]` exclusiveMinimum 0 | camelCase |
| reminders | POST `/v1/pets/{id}/reminders` | `PetReminderWrite` required `[kind,time_local,days_of_week]` | not wired in UI (optional) |
| care tip | POST `/v1/pets/ai/care-tip` | `PetCareTipWrite` | not wired (501 when gateway off) |
| calendar | no all-records route | list pets then records/weights per id | local arrays |

### M8 学习打卡

| Store / UI | Endpoint | Schema | Mismatch vs current web |
|---|---|---|---|
| `today()` local | GET `/v1/study/today` | `StudyToday` (`due_flashcards`, derived streaks) | never called → empty page |
| `createChallenge({name,targetDays,timezone})` | POST `/v1/study/challenges` | `StudyChallengeWrite` required `[name,target_days]` enum **7/14/21** | casing; UI already limits buttons to 7/14/21 |
| `checkin(id, day)` | POST `/v1/study/challenges/{id}/checkins` | `StudyCheckinWrite` optional `day` | send `{day}` YYYY-MM-DD; omit if defaulting server today |
| `addCard({front,back,category})` | POST `/v1/study/flashcards` | `StudyFlashcardWrite` required `[front,back]`; optional `category`; `file_url` rejected | omit empty category; never send `file_url` |
| `review(id, grade)` | POST `/v1/study/flashcards/{id}/review` | `StudyReviewWrite` required `[grade]` enum `again\|hard\|good\|easy` | UI grades match; **do not recompute SM-2 on the client** when HTTP |
| due list | GET `/v1/study/flashcards/due` | `StudyFlashcardList` | unused |
| `addNote({title,contentMd,tags})` | POST `/v1/study/notes` | `StudyNoteWrite` required `[title]`; `content_md`, `tags` | camelCase `contentMd` |
| `searchNotes(q)` | GET `/v1/study/notes?q=` | title/tags only | local `matchesNote` |
| `addSkill({title,parentId})` | POST `/v1/study/skills` | `StudySkillWrite` required `[title]`; `parent_id` **string (non-nullable)** | omit empty parent |
| `toggleSkill` | PATCH `/v1/study/skills/{id}` | `StudySkillPatch` `unlocked` | local flip |
| `applyTemplate('english-vocab'\|'piano')` | GET templates + POST `/v1/study/skills/from-template` | `StudyFromTemplate` required `[template_id]` | hardcoded trees; server ids happen to be `english-vocab` and `piano` — **still load the list** |
| focus timer | none | — | stays browser-only |

## Self-grill (Superpowers): alternatives

Proposer vs skeptical reviewer. Three or more alternatives per decision, checked against the live tree after `812a3a2`.

### D1 — How adapters talk to HttpQingxinApi

**Chosen:** Append typed pets/study methods to `QingxinApi`. `HttpQingxinApi` implements them with private `#json`. Payload builders live in `lib/pets/http.ts` and `lib/study/http.ts` so contract tests can validate bodies without importing the HTTP class. `MockQingxinApi` implements the same methods for unit tests.

**Assumptions challenged:** The draft assumed `request<T>(method, path, body?)`. That method does not exist; `#json` is private. Forking fetch + session would duplicate 401 refresh.

**Rejected:**

1. **Public `requestJson` on HttpQingxinApi** — leaks transport; screens could skip mapping; mock would not implement it, so stores need two backends.
2. **openapi-fetch / generated client as the app API** — Quill already rejected this; screens speak camelCase `QingxinApi`. Types-only from YAML is fine for contract tests.
3. **Per-module fetch + copied token key `qingxin.session`** — forks auth; refresh races; violates “never fork auth”.
4. **SvelteKit `+page.ts` loaders hitting `/v1` on the server** — static adapter, token is in localStorage, PWA offline; SSR auth is extra plumbing.

**Grill:** *Will appending methods conflict with M2/M3/M7?* Yes on `types.ts` / `http.ts` / `mock.ts`. Mitigate by appending at the end of the interface and classes only; no reformat of existing methods. *Does Mock need persistence?* Yes, `hydrateUserList` like mood, so screenshot E2E with `mock-token-demo` does not crash; empty pets is OK (screenshots do not assert pet rows).

### D2 — Reactivity

**Chosen:** `$state` rune classes in `store.svelte.ts` (Svelte 5 runes compile only there). Pages keep calling `getPetsStore()` / `getStudyStore()`. `onMount` → `load()`. Mutations assign through `$state` arrays so `{#if store.pets.length === 0}` tracks.

**Rejected:**

1. **Only `$state` + localStorage, no API** — fixes “doesn't save” in-session; still empty vs API; Ge approved wiring.
2. **Svelte `writable` stores** — repo is runes-mode (`vite.config.ts` `runes: true`); mood already uses functions + page `$state`, but a shared class is what pets/study pages already assume.
3. **Page-local `$state` copies without a shared store** — calendar, detail, and home would diverge.
4. **Keep `tick += 1` `{#key}` hacks** — check-in page already does this; pets home still stuck because `selected` stays 0.

**Grill:** *Can Vitest import `.svelte.ts`?* SvelteKit Vite plugin compiles it in the existing server project. Store method tests do not need fine-grained subscriptions; E2E proves the empty-state transition.

### D3 — Optimistic updates and offline

**Chosen:** Same pattern as mood: optimistic apply, reconcile with server entity, `enqueueSync` when `navigator.onLine === false`, snapshot in IndexedDB `lib/offline`.

**Rejected:**

1. **Wait for every POST before painting** — empty-state bug would still be fixed by `$state`, but the issue asks for immediate leave-empty.
2. **Service-worker replay** — out of scope; T2 already has the IDB queue.
3. **No cache** — `/pets` would flash empty on revisit offline.

### D4 — Testing

**Chosen:** (a) Vitest contract helper: load `api/openapi.yaml`, ajv-validate each write builder against `components.schemas.*`. Explicit assertion that builders emit `avatar_url` not `avatarUrl`. (b) `HttpQingxinApi` stub-fetch tests for one pet create and one study challenge. (c) Store tests against `MockQingxinApi`. (d) New `web/e2e/pets-study.e2e.ts` in the existing API Playwright config (do not rewrite `api.e2e.ts` beyond `testMatch` if needed). CI job already boots Axum.

**Rejected:**

1. **MSW-only E2E** — would not prove Axum schemas.
2. **Put cases into `api.e2e.ts`** — merge conflict with other wiring agents.
3. **Component Testing Library for the empty state** — no client vitest project today; E2E is the user-visible proof.

## Decisions (summary)

| ID | Decision |
|---|---|
| D1 | Typed `QingxinApi` methods + module `http.ts` builders |
| D2 | `$state` stores in `store.svelte.ts` |
| D3 | Optimistic + IDB cache like mood |
| D4 | ajv contract tests + separate Playwright file against live API |

## Risks / Trade-offs

- **[Risk] Merge conflict on `QingxinApi`** → append-only methods; tiny hunks.
- **[Risk] `compact()` would send `null`** → builders use omit-empty; never pass null into `#json`.
- **[Risk] Skill template ids drift** → UI lists `GET /templates` and posts `template_id`.
- **[Risk] Review SM-2 differs if client still computes** → HTTP path uses the POST response only; `review.ts` stays for mock + unit tests of the algorithm.
