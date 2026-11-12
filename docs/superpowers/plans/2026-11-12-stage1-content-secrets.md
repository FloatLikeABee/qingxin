# Stage 1 Content + Secrets (CE plan, short)

**Goal:** Web-only Qingxin Stage 1: colorful bento, drop 组件, Content share, Secrets mailbox.

**How:** TDD helpers → mock/HTTP/API → UI → e2e/screenshots. One branch, one PR.

**Stack:** SvelteKit frontend, Axum API, Vitest, Playwright, sqlx migrations.

**Constraints:** Official share only. Secrets encrypted, consented, not public, not chat. No games. No native apps.

**Verify:** `npm test`, `npm run check`, `npm run build`, `cargo test --test secrets`, focused e2e, screenshots.
