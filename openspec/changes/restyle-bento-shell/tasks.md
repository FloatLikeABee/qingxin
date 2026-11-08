# Tasks

## 1. Layout helpers (TDD)

- [ ] 1.1 Write failing Vitest cases for bento spans, 1/2/4 column reflow, sparse placement (no overlap, DOM order), and 16px gutter
- [ ] 1.2 Implement `web/src/lib/ui/bento.ts` and verify those tests pass
- [ ] 1.3 Write failing Vitest cases for password toggle type/label and link class tokens
- [ ] 1.4 Implement `web/src/lib/ui/affordance.ts` and verify those tests pass

## 2. Tokens and kit

- [ ] 2.1 Add `--qx-gutter` and muted `--qx-danger`; keep exact palette variables
- [ ] 2.2 Add Bento/BentoItem, password toggle on Input, `.qx-link`, page Skeleton, dynamic Tabs, button `px-6`
- [ ] 2.3 Document the new primitives on `/kit`

## 3. Shell and existing screens

- [ ] 3.1 Restyle AppShell (spacing, icon+label, module-hub CTA, min-inline-size 0)
- [ ] 3.2 Apply bento to home, `/modules`, settings, login/register, placeholder, finance/wellness/study homes, elder tools, mood meditate, AI tool cards, hustle idea cards, create inspiration
- [ ] 3.3 Make 返回模块中心 / auth switch links use `.qx-link`

## 4. Verification

- [ ] 4.1 Playwright: overflow at 390/1280, password toggle, bento hosts, focus order, settings screenshots light/dark
- [ ] 4.2 `npm test`, `npm run check`, `npm run build` in `web/`
- [ ] 4.3 Copy screenshots to `/opt/cursor/artifacts/`
- [ ] 4.4 Archive this OpenSpec change; open PR; do not merge
