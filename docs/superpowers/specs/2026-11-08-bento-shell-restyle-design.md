# Qingxin bento shell restyle — design

Date: 2026-11-08  
Base: `49b2abf48bda455a64bcf3969df3346dc0749001` (`origin/main`)  
OpenSpec: `openspec/changes/restyle-bento-shell/`

## Intent

Apply the **actual** guidance from 40 UX instruction slides to Qingxin’s existing Svelte UI: responsive asymmetric bento, consistent gutters, hierarchy, restrained color (especially dark), icon+text, short nav, visible affordance, labeled inputs, password toggle, skeletons, avoid super-minimal chrome. Keep Chinese language, exact product palette, all features/API/data, accessibility.

## Approaches (self-grill)

| Approach | Verdict |
| --- | --- |
| A. Palette-only | **Inadequate.** Slides are layout/UX rules, not a purple theme. |
| B. Wholesale redesign | **Too broad.** Would rewrite every module, risk APIs, invite pricing CTAs. |
| C. Shared components + bento | **Recommended.** Tokens, Bento, Input, links, Skeleton, Tabs, AppShell; wrap existing card sections. |

## Architecture

1. Pure helpers `web/src/lib/ui/bento.ts` + `affordance.ts` (unit tested).
2. CSS in `layout.css`: `--qx-gutter`, muted `--qx-danger`, `.qx-bento-host` container queries, `.qx-link`. Grid uses `minmax(0,1fr)`, `min-inline-size: 0`, **no dense packing**.
3. Components: `Bento.svelte`, `BentoItem.svelte`; Input password toggle; Skeleton `page`; Tabs `repeat(n)`.
4. Screens: home, hub, settings, login/register, kit, and card grids on finance/wellness/study/elder/mood/ai/hustle/create/placeholder.
5. Shell: 4 short labeled tabs; sidebar CTA → `/modules` (not pricing).

## Product decisions (not blocked)

- No forgot-password, social login, or OTP UI (would be new product, not restyle).
- Study chrome keeps 6 short destinations (hiding them drops features).
- Elder emergency call buttons stay high-contrast red for safety.

## Spec self-review

- No TBD/TODO left in this spec.
- Palette requirement does not contradict “restrained color”: spec colors stay; only non-spec danger is muted.
- Scope is one implementation plan.
- “Bento on narrow screens” means 1-column reflow, not keeping 2×2 heroes on 390px.
