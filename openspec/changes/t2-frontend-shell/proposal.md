# Proposal

## Why

Qingxin (轻心) has an empty repository and no user-facing product. Issue #1 requires a premium SvelteKit PWA shell so T1's Forge backend can be swapped in later without rewriting navigation, theming, offline, or compliance.

## What Changes

- Add a SvelteKit + TypeScript (strict) + Tailwind app at `web/` with zh-CN UI.
- Ship a PWA (manifest name 轻心, icons, service worker, offline app-shell + fallback).
- Add IndexedDB cache and a silent re-sync queue with an offline banner.
- Implement ThemeProvider modes: 浅色 / 深色 / 跟随系统 / 仅夜间开启 via CSS variables + Tailwind `dark:` class strategy, no flash on load, exact spec palette.
- Ship a design-system kit (Button, Card, Input/Textarea, Tag, Tabs, Switch, Toast, Drawer, Modal, Skeleton, EmptyState, ListItem, Icon) documented on `/kit`.
- Add mobile-first navigation (bottom tabs on phones, sidebar on desktop) and a hub for the 10 product modules.
- Add first-run privacy consent, disclaimers, login/register, and settings (theme, export, delete stubs).
- Add a typed API client behind an interface with a mock implementation until T1 lands.
- Add `.github/workflows/web.yml` (path filter `web/**`) running install, svelte-check, Vitest, and build.

## Capabilities

### New Capabilities

- `theming`: Resolve and apply light/dark/system/night-only themes without flash, using the exact palette.
- `offline-pwa`: Installable PWA with offline app-shell, fallback page, IndexedDB cache, and silent re-sync.
- `design-system`: Shared UI primitives, `/kit` demo, tap targets, motion that respects reduced-motion.
- `app-shell`: zh-CN chrome, responsive navigation, and the 10-module hub.
- `compliance`: First-run privacy, disclaimers, auth screens, settings export/delete entry points.
- `api-client`: Typed client interface with a mock implementation swappable for T1 OpenAPI.

### Modified Capabilities

- None (greenfield repository).

## Impact

- New `web/` application and root GitHub Actions workflow.
- OpenSpec artifacts for T2; no backend, no real content-security vendor, no T1 API.
- Playwright screenshots at 390px and 1280px in light and dark, committed for the PR.
