# Design

## Context

Base SHA after `git fetch origin main`: `49b2abf48bda455a64bcf3969df3346dc0749001` (equals the reported Mac checkout). Qingxin is SvelteKit 5 + Tailwind 4 + existing kit. Forty UX instruction slides were read in full (archive `samples/` + contact sheets). They are **not** a purple brand: bento modularity, consistent gaps, hierarchy, dark-mode desaturation, icon+text, short nav, visible links/buttons, labeled fields, password toggle, skeletons, avoid super-minimal UI.

ECC frontend-patterns / tdd-workflow / verification-loop (pinned `d2ef268`) are applied in Svelte, not React. Modern-web-guidance (`css-layout`, `responsive-design`, `overflow-clipping-control`, `size-aware-styling`) requires CSS Grid with `minmax(0, 1fr)`, container queries for component context, **no `grid-auto-flow: dense` on interactive content**, no `overflow: hidden` to mask overflow, no `100vw` full-width.

## Goals / Non-Goals

**Goals**

- Responsive asymmetric bento on every card-like section of existing important screens.
- Shared tokens/components so later screens inherit the pattern.
- Keyboard/focus order matches DOM; no horizontal overflow at 390 and 1280.
- Skeleton loading on placeholder modules; password toggle on login/register; clickable links.

**Non-goals**

- Backend, OpenAPI, pricing, Oldpeople, new auth providers, forgot-password, SMS OTP boxes, collapsing study chrome from 6 links to 5, a standalone marketing demo page.

**Anti-goals**

- Replacing Qingxin blue with a purple slide aesthetic.
- `grid-auto-flow: dense` or `order`/`flex-direction: reverse` on interactive cards.
- Installing a React/plugin stack or extra agents.

## Decisions

### D1 — Approach

**Chosen:** Targeted shared components + bento (approach 3).

**Rejected:** palette-only (misses layout/affordance); wholesale redesign (scope/API risk).

### D2 — Grid mechanics

**Chosen:** Sparse CSS Grid, `gap: var(--qx-gutter)`, tracks `repeat(N, minmax(0, 1fr))`, item `min-inline-size: 0`. Column count via **container queries** on a host (`1` / `2` / `4` at ~34rem / ~48rem) because AppShell steals ~16rem for the sidebar. 48rem is the 4-column floor so a 1280px window with the sidebar still gets a 4-track bento. Spans: `unit` 1×1, `wide` 2×1, `hero` 2×2 (wide only), `full` all columns. Span recipes are packed so auto-placement fills rows without dense packing (e.g. hub: hero + wide + wide, then unit/unit/wide).

**Rejected:** viewport-only `md:` grids (wrong inside sidebar); masonry/grid-lanes (not baseline); dense packing (breaks tab order).

### D3 — Palette

**Chosen:** Keep exact `palette` from `theming` spec. Add `--qx-gutter` (16px) and a muted `--qx-danger` for kit danger buttons. Module accent chips stay as identity colors. Elder emergency `tel:` buttons stay high-contrast for safety.

**Rejected:** restyling to the slides’ purple; changing `#3B82F6` / `#60A5FA`.

### D4 — Forms and auth chrome

**Chosen:** Labels above fields (already). Hint placeholders. Password eye toggle **inside** the field, 44px, `aria-label` 显示密码/隐藏密码. Login ↔ register stay separate routes with clearly clickable links (no lost-input tab widget unless we add client state sharing — out of scope). Do **not** add social login, forgot-password, or OTP UI (API SMS exists but web login is email/password only; inventing those is a product change).

**Rejected:** placeholder-as-label; spinner-only pending; dead forgot-password link.

### D5 — Navigation

**Chosen:** Keep four primary tabs (首页 / 模块 / 组件 / 我的) with icon+text. Sidebar: logo, nav, 打开模块中心 CTA (not pricing), disclaimer. Module chrome back-links use `.qx-link`. Study’s six short destinations remain — hiding them would drop features; recorded as an explicit non-change.

### D6 — Loading

**Chosen:** Expand `Skeleton` with a `page` variant (avatar + bars + blocks). Placeholder `[slug]` already uses Skeleton; keep it (no classic centered spinner). Button pending copy (登录中…) stays as status text (avoid super-minimal).

## Risks

- Screenshot e2e asserts copy like 轻心实验室 from hustle demo data — do not rename.
- Tabs currently hardcode `grid-cols-3`; all production Tabs have 3 items — change must remain 3-column when `tabs.length === 3`.
- Container query breakpoints must still look correct at Playwright 390 (1 col) and 1280 with sidebar (2 or 4 col).

## Skills actually used (record)

- Superpowers: using-superpowers, brainstorming, writing-plans, executing-plans, test-driven-development, verification-before-completion, finishing-a-development-branch (PR, not merge). No subagent-driven-development (user: only coding worker).
- ECC (`affaan-m/ECC@d2ef268`): frontend-patterns (Svelte-adapted composition, a11y, skeleton fallback), tdd-workflow, verification-loop.
- modern-web-guidance: css-layout, responsive-design, overflow-clipping-control, size-aware-styling.
- OpenSpec: this change.
- Canvas skill: not used (deliverable is a PR, not a standalone canvas).
