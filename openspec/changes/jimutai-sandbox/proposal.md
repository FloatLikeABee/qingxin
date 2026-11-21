# Proposal

## Why

Ge asked to drop 本地生活, AI效率工具箱, 学习打卡, and 求职副业 from the product face, and to add another fun Three.js game in the spirit of 上班: a relaxed construction sandbox with five small pieces at a time.

## What Changes

- New module `jimutai` / 积木台: small snapped 3D pieces, five-piece tray, refill only when the batch is placed, undo, orbit camera, isolated local save.
- Hub, home, and recommendations no longer list the four retired modules. Legacy URLs show a retired notice or redirect without mounting those UIs.
- Archival libraries, API helpers, and stored user records stay. 上班 Stage 1, Secrets, and catalog games stay.

## Capabilities

### New Capabilities

- `jimutai`: construction sandbox with five-piece batches.
- `retired-modules`: safe deep links for local / ai / study / hustle.

### Modified Capabilities

- `app-shell`: hub/home catalog; 求职概览 replaced by 积木台; `/study` redirects.

## Impact

- `web/src/lib/jimutai/**`, `/modules/jimutai`, retired route pages, Vitest, Playwright.
- No Axum schema changes. No new npm packages.
- 上班 Stage 2/3 stay out.
