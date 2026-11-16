# Proposal

## Why

Ge asked to ditch the login-gated 内容创作 module as the product face and replace it with 上班: a stylized Three.js company you walk, not a dashboard. They approved the five-floor design and a three-stage build. Stage 1 is a playable building with distinct role tasks.

## What Changes

- New module `shangban` / 上班: five furnished floors, elevator, seven immediately selectable roles, distinct task kinds, guest local save.
- Hub, home, and primary nav point at 上班 instead of 内容创作.
- `/modules/create` stays as a legacy studio so drafts, IndexedDB, and `/v1/create/*` are not deleted.
- Secrets and catalog games (便利店经理, 窗前庭园, 晴空出击) untouched except nav copy that named 内容创作.

## Capabilities

### New Capabilities

- `shangban`: Stage 1 company sim — floors, roles, tasks, NPCs, save, Three.js play view.

### Modified Capabilities

- `app-shell`: 上班 replaces 内容创作 as the primary module/tab; `/modules/create` remains a legacy route.

## Impact

- `web/src/lib/shangban/**`, `/modules/shangban`, nav/home/hub, Vitest, Playwright.
- No Axum/API schema changes. No new npm packages.
- Stage 2/3 (relationships, cross-floor quests, career polish) stay out of this change.
