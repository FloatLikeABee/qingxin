## 1. Contract harness (tests first)

- [x] 1.1 Add ajv, ajv-formats, and js-yaml as web devDependencies
- [x] 1.2 Write `web/src/lib/api/contract.spec.ts` that loads `api/openapi.yaml` and validates a body against `components.schemas.<Name>`; include a failing case that `avatarUrl` is not an accepted adapter output
- [x] 1.3 Add `web/src/lib/pets/http.ts` and `web/src/lib/study/http.ts` write builders + mappers; contract-test every POST/PATCH in the design tables (PetWrite, PetRecordWrite, PetWeightWrite, PetLogWrite, StudyChallengeWrite, StudyCheckinWrite, StudyFlashcardWrite, StudyReviewWrite, StudyNoteWrite, StudySkillWrite, StudyFromTemplate)
- [x] 1.4 Reject `target_days` other than 7/14/21 in the study challenge builder; omit null/empty optionals (no `null` on the wire)

## 2. QingxinApi methods (tests first)

- [x] 2.1 Append pets and study method signatures to `QingxinApi` in `types.ts` (end of interface only)
- [x] 2.2 Write failing `http.spec.ts` cases: POST `/v1/pets` body has `avatar_url` and no `avatarUrl`; POST `/v1/study/challenges` has `target_days` 21
- [x] 2.3 Implement those methods on `HttpQingxinApi` using `#json` and the module builders (do not add a public `request()`; do not rewrite auth)
- [x] 2.4 Implement the same methods on `MockQingxinApi` (in-memory + existing persist helpers); register/login hydrate empty pets/study lists
- [x] 2.5 Point pets/study stores at `getApi()` from `#lib/api/client`

## 3. Reactive stores and pages

- [x] 3.1 Rewrite pets and study stores as `$state` rune classes (`store.svelte.ts`); `load()` on mount; optimistic create + reconcile; IndexedDB snapshot
- [x] 3.2 Remove client-only today/streak computations the server already returns; keep the browser focus timer
- [x] 3.3 Skills page lists templates from `listStudySkillTemplates()` and copies via `template_id`; review posts server grades
- [x] 3.4 Update pets/study pages so adding a pet leaves the empty state without a `tick` hack

## 4. E2E against the real API

- [x] 4.1 Add `web/e2e/pets-study.e2e.ts`: register unique user; add 豆豆 → visible → reload still visible; feed log; add weight; create 21-day challenge → check in → streak 1; flashcard review
- [x] 4.2 Include the new file in `playwright.api.config.ts` `testMatch` (do not replace existing `api.e2e.ts` cases)

## 5. Verify and archive

- [x] 5.1 `npm test`, `npm run check`, `npm run build` in `web/`
- [x] 5.2 Cargo tests: `api/src/tools.rs` now falls through to mock 示意 SSE when the gateway is Failed (Ollama down); `cargo test --workspace` green
- [x] 5.3 `/opsx-archive` (`openspec archive wire-m6-m8 -y`); open a ready PR that Refs #17 and #19
