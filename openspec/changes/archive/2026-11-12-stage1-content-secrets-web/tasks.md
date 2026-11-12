# Tasks

## 1. Specs and failing tests

- [x] 1.1 Nav, share-pack, secrets consent/letter/board Vitest cases (RED)
- [x] 1.2 Mock + HTTP client secrets tests (RED)
- [x] 1.3 Rust API tests: consent, isolation, encryption, export/delete (RED)

## 2. Domain and API

- [x] 2.1 Implement share helpers and secrets letter/board/consent helpers
- [x] 2.2 Migration `0012_secrets.sql`, `api/src/secrets.rs`, OpenAPI, export/delete
- [x] 2.3 Wire `QingxinApi` mock + HTTP

## 3. UI

- [x] 3.1 Drop 组件 from nav; Content tab; richer palette; games 即将到来
- [x] 3.2 Content posting/share panel (official mechanisms only)
- [x] 3.3 Artistic Secrets mailbox page (zh-CN, consent, board of letters)

## 4. Verify

- [x] 4.1 Unit, `cargo test` secrets, `npm run check`, build
- [x] 4.2 Focused e2e for Content and Secrets; screenshots Home/Content/Secrets at 390 and 1280
- [x] 4.3 Self review (ponytail / ECC / CE); archive OpenSpec; open PR
