# Tasks

## 1. Scaffold and unit tests first

- [x] 1.1 Scaffold SvelteKit + TS strict + Tailwind + Vitest in `web/` and verify `package.json` scripts `check`, `test`, and `build` exist
- [x] 1.2 Write failing Vitest cases for theme resolution (light/dark/system/night-only) and verify they fail because the resolver is missing
- [x] 1.3 Implement `resolveTheme` + tokens and verify theme unit tests pass
- [x] 1.4 Write failing Vitest cases for IndexedDB cache get/set and silent outbox drain and verify they fail
- [x] 1.5 Implement the IndexedDB wrapper and verify cache unit tests pass
- [x] 1.6 Write failing Vitest cases for the mock API client (login success/reject, export) and verify they fail
- [x] 1.7 Implement `QingxinApi` + `MockQingxinApi` and verify API unit tests pass

## 2. Theme, PWA, and chrome

- [x] 2.1 Add CSS variables, Tailwind `dark:` class strategy, and a no-flash boot script and verify stored dark mode sets `document.documentElement.classList` to include `dark`
- [x] 2.2 Add web manifest (name 轻心), icons, service worker, and offline fallback and verify the manifest JSON contains name 轻心
- [x] 2.3 Build the design-system primitives and `/kit` demo and verify `/kit` renders every required component label
- [x] 2.4 Build AppShell (phone tabs + desktop sidebar), home, and the 10-module hub and verify all ten module names render
- [x] 2.5 Add privacy consent, disclaimer, login/register, and settings (theme/export/delete) and verify first-run consent gating works in the client store
- [x] 2.6 Add offline banner + reconnect drain wiring and verify the banner copy is zh-CN

## 3. CI, quality gates, and evidence

- [x] 3.1 Add `.github/workflows/web.yml` with path filter `web/**` running install, svelte-check, Vitest, and build and verify the YAML triggers on pull_request and push to main
- [x] 3.2 Run `npm run test`, `npm run check`, and `npm run build` in `web/` and verify all three exit 0
- [x] 3.3 Capture Playwright screenshots at 390px and 1280px in light and dark and verify four PNG files are committed under `web/screenshots/`

## Workflow follow-up

- Archive the OpenSpec change after implementation and screenshots.
- Open a PR whose body contains `Refs #1` (not Closes). Do not merge.
