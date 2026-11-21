# Space-dust chrome-glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; no reviewer fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Replace Qingxin’s sidebar shell with a full-width module board, cosmic dust backdrop, and chrome-glass surfaces, without touching game worlds or persisted theme/data.

**Architecture:** Pure TS dust field in `web/src/lib/shell/dust.ts`; canvas host `SpaceDust.svelte`; navigation list in `nav.ts`; glass tokens in `layout.css`; AppShell drops the aside and bottom tabs for a compact top bar. Kit primitives opt into `.qx-glass` / `.qx-glass-field`. Home and `/modules` share a `ModuleBoard` snippet.

**Tech Stack:** Existing SvelteKit 3, TypeScript, Vitest, Playwright, CSS canvas 2D. No new dependencies.

## Global Constraints

- Same branch/PR as 上班 Stage 1 + 积木台: `cursor/shangban-stage1-4e4e`. Do not open a competing PR. Do not merge.
- Theme key `qingxin.theme` default `system`. Never overwrite on load.
- Dark cosmic `#070b14`; light dawn `#eaf3ff`. Qingxin blue `#3B82F6` / `#60A5FA`.
- Dust: canvas 2D, ≤36 motes, 24 fps target, pause on hidden and on play views, static under reduced motion.
- No extra WebGL. No dust over game canvases. No sidebar / hamburger / bottom tabs.
- Retired four modules stay retired. 上班 / 积木台 / garden / store / shooter worlds unchanged.
- zh-CN. Guest + mock session fixtures only.

## File map

Create:

- `web/src/lib/shell/dust.ts` + `dust.spec.ts`
- `web/src/lib/shell/SpaceDust.svelte`
- `web/src/lib/shell/ModuleBoard.svelte`
- `web/e2e/space-glass.e2e.ts`
- `docs/superpowers/specs/2026-11-18-space-glass-design.md` (this pair)
- `openspec/changes/space-glass-shell/**`

Modify:

- `web/src/lib/nav.ts`, `nav.spec.ts`
- `web/src/lib/components/AppShell.svelte`
- `web/src/routes/layout.css`
- `web/src/lib/theme/resolve.ts` (+ spec dark background)
- `web/src/lib/components/{Card,Button,Input,Textarea,Modal,Drawer,Tabs}.svelte`
- `web/src/routes/+page.svelte`, `web/src/routes/modules/+page.svelte`
- `web/src/lib/finance/FinanceChrome.svelte`, `PetsChrome`, `WellnessChrome` inner chips if opaque
- `web/src/app.html` dark theme-color
- e2e: `shell`, `screenshots`, `api`, `content-secrets`, `games`, `shangban`, `bento` as needed
- `openspec/specs/app-shell/spec.md`

---

### Task 1: Dust field (TDD)

**Files:** `web/src/lib/shell/dust.ts`, `dust.spec.ts`

- [x] Write failing tests: 36 motes, 4 clouds; outward drift; `shouldAnimateDust` false when hidden / play / reduced-motion; respawn stays in bounds; reduced-motion step is identity
- [x] Run RED
- [x] Implement `createDustField`, `stepDust`, `shouldAnimateDust`, constants
- [x] GREEN

### Task 2: Top bar destinations (TDD)

**Files:** `nav.ts`, `nav.spec.ts`

- [x] Rewrite tests: three TOPBAR items 首页 / 模块中心 / 我的; kit absent; 上班 not a chrome tab; `/modules/jimutai` marks 模块中心; `/modules/shangban` does not steal 首页
- [x] RED, implement, GREEN

### Task 3: AppShell + dust host

**Files:** `AppShell.svelte`, `SpaceDust.svelte`, `layout.css`, `app.html`

- [x] Remove `aside` and `nav.fixed`
- [x] Compact `header[data-qx-topbar]` with the three links, glass
- [x] Mount SpaceDust only when not playView; pointer-events none
- [x] Full width, no `w-64` gutter; reduce `pb-28` leftover from tabs
- [x] Hide top bar on play views
- [x] Charcoal tokens; nebula CSS; stronger `.qx-glass` + `.qx-glass-field` + fallbacks

### Task 4: Kit primitives glass

**Files:** Card, Button, Input, Textarea, Modal, Drawer, Tabs

- [x] Card and secondary Button use `.qx-glass`
- [x] Fields use `.qx-glass-field` (higher opacity)
- [x] Modal/Drawer panels glass; toasts stay solid
- [x] Unit/affordance tests still pass

### Task 5: Board on home and hub

**Files:** `ModuleBoard.svelte`, `+page.svelte`, `modules/+page.svelte`

- [x] Shared board of live MODULES (not retired)
- [x] Home keeps greeting + 积木台/上班 heroes, then the board
- [x] Hub uses the same board

### Task 6: E2E + living spec

- [x] `space-glass.e2e.ts`: no aside, no `nav.fixed`, top bar destinations, 上班 from board, kit from settings, 390/768/1280/1600 no overflow, reduced-motion dust static, play view no dust canvas
- [x] Update shell/api/screenshots/content-secrets/games/shangban that asserted sidebar/tabs
- [x] Update `openspec/specs/app-shell/spec.md`

### Task 7: Verify

- [x] `npm test`, `npm run check`, build
- [x] Playwright: space-glass, jimutai two-batch, 上班 smoke, games smokes
- [x] BEFORE/AFTER screenshots 390/1280 light/dark hub + settings + a game dock
- [x] Short dust+nav recording; measured rAF cadence
