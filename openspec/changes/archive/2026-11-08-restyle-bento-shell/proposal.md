# Proposal

## Why

Qingxin already has a working zh-CN SvelteKit shell, kit primitives, and ten modules, but card-like regions are mostly equal-width stacks. The attached UX instruction slides (40 samples, plus contact sheets) ask for modular bento layouts, consistent gutters, labeled controls, visible affordance, skeleton loading, and restrained (not pure) color — not a branded purple reskin. Palette-only tweaks would miss those behaviors; a wholesale redesign of every module would break scope and data flows.

## What Changes

- Add shared bento layout primitives (host + item spans) driven by CSS Grid and **container queries**, so the shell sidebar does not fool viewport media queries.
- Apply asymmetric, intentionally varied spans to card-like sections on existing important screens: home, module hub, settings, kit, login/register, and module landings that already present card grids (finance, wellness, study, elder tools, mood meditate, AI toolbox, hustle ideas, create inspiration, placeholder).
- Harden kit controls from the slides: password visibility toggle inside the field, 44px targets, 16px field gaps, labeled inputs with hint placeholders, clickable links (underline + color + chevron), Tabs 3–5 columns, richer skeletons instead of indefinite spinners, icon+text nav, short labels.
- Keep the exact Qingxin theme tokens (`#3B82F6` / `#60A5FA` and companions). Mute only non-spec accents (danger) away from pure hues. No new purple theme.
- Preserve Chinese copy, all features, APIs, mock/HTTP clients, pricing (none), and accessibility (DOM order = focus order; no `grid-auto-flow: dense` on interactive cards).

## Capabilities

### New Capabilities

- `bento-layout`: Shared responsive bento grid with unit/wide/hero/full spans, consistent gutters, 1/2/4 columns by **container** width, no horizontal overflow, preserved source order.

### Modified Capabilities

- `design-system`: Input password toggle; link affordance; skeleton page variant; Tabs column count; button inline padding; kit documents bento.
- `app-shell`: Sidebar/tab spacing and structure (logo, icon+label nav, module-hub CTA, disclaimer); card-like home/hub/settings layouts use bento; back-links look clickable.
- `theming`: Exact palette unchanged. Add gutter/danger tokens that do not replace spec colors.

## Impact

- Frontend only (`web/src`, OpenSpec, docs, Playwright). No `api/`, OpenAPI, migrations, or pricing.
- Existing e2e copy and headings (求职概览, 内容创作, 轻心实验室, 模块中心, 我的) stay visible.
- Out of scope: Oldpeople, social login, forgot-password (no web route/API UX), SMS OTP UI, collapsing study’s six destinations, new demo-only marketing page.

## Self-grill of 3 approaches

1. **Palette-only** — retint CSS variables. Inadequate: slides are interaction/layout instructions (bento, skeleton, labels, toggle, affordance), not a color way.
2. **Wholesale redesign** — restyle every module pixel and invent new IA. Too broad: touches data, extra screens, pricing-like CTAs, high regression risk.
3. **Targeted shared components + bento (recommended)** — tokens, `Bento`/`Input`/`link`/`Skeleton`/`Tabs`/`AppShell`, then wrap existing card sections. Matches the PO scope: high-quality sample-matched work, credit-efficient, features preserved.
