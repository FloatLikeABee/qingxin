# Tasks

## 1. Layout helpers (TDD)

- [x] 1.1 Write failing Vitest cases for bento spans, 1/2/4 column reflow, sparse placement (no overlap, DOM order), and 16px gutter
- [x] 1.2 Implement `web/src/lib/ui/bento.ts` and verify those tests pass
- [x] 1.3 Write failing Vitest cases for password toggle type/label and link class tokens
- [x] 1.4 Implement `web/src/lib/ui/affordance.ts` and verify those tests pass

## 2. Tokens and kit

- [x] 2.1 Add `--qx-gutter` and muted `--qx-danger`; keep exact palette variables
- [x] 2.2 Add Bento/BentoItem, password toggle on Input, `.qx-link`, page Skeleton, dynamic Tabs, button `px-6`
- [x] 2.3 Document the new primitives on `/kit`

## 3. Shell and existing screens

- [x] 3.1 Restyle AppShell (spacing, icon+label, module-hub CTA, min-inline-size 0)
- [x] 3.2 Apply bento to home, `/modules`, settings, login/register, placeholder, finance/wellness/study homes, elder tools, mood meditate, AI tool cards, hustle idea cards, create inspiration
- [x] 3.3 Make 返回模块中心 / auth switch links use `.qx-link`

## 4. Verification

- [x] 4.1 Playwright: overflow at 390/1280, password toggle, bento hosts, focus order, settings screenshots light/dark
- [x] 4.2 `npm test`, `npm run check`, `npm run build` in `web/`
- [x] 4.3 Copy screenshots to `/opt/cursor/artifacts/`
- [x] 4.4 Archive this OpenSpec change; open PR; do not merge
