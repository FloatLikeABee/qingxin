# Bento shell restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Do **not** use subagent-driven-development — the user forbade extra agents.

**Goal:** Restyle Qingxin’s shared shell/tokens/components and existing card-like screens into responsive asymmetric bento layouts that match the 40 UX slides, without API or pricing changes.

**Architecture:** Test-first pure layout helpers, then CSS Grid + container queries, then kit components, then wrap existing routes. Sparse placement only (no dense). Exact Qingxin palette.

**Tech Stack:** SvelteKit 5, Tailwind 4, Vitest, Playwright, existing kit.

## Global Constraints

- zh-CN copy and existing headings stay (求职概览, 内容创作, 轻心实验室, 模块中心, 我的).
- Exact theme tokens: light `#3B82F6/#FFFFFF/#1F2937/#6B7280`, dark `#60A5FA/#111827/#F9FAFB/#9CA3AF`.
- No `api/` edits, no social login, no forgot-password, no Oldpeople, no pricing CTA.
- Interactive grids: no `grid-auto-flow: dense`, no CSS `order`.
- Controls ≥ 44px; bento gutter 16px; columns via container queries.
- Branch: `cursor/qingxin-bento-restyle-ba81` off `49b2abf`.

---

### Task 1: Bento helpers (RED → GREEN)

**Files:**
- Create: `web/src/lib/ui/bento.ts`
- Test: `web/src/lib/ui/bento.spec.ts`

**Interfaces:**
- Produces: `BentoSpan`, `BENTO_GUTTER_PX`, `bentoItemClass`, `tracksForColumns`, `planBentoSpans`, `placeSparse`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
	BENTO_GUTTER_PX,
	bentoItemClass,
	placeSparse,
	planBentoSpans,
	tracksForColumns
} from './bento';

describe('bento', () => {
	it('uses a 16px gutter', () => {
		expect(BENTO_GUTTER_PX).toBe(16);
	});

	it('collapses every span to 1x1 on one column', () => {
		for (const span of ['unit', 'wide', 'hero', 'full'] as const) {
			expect(tracksForColumns(span, 1)).toEqual({ col: 1, row: 1 });
		}
	});

	it('packs ten hub tiles without overlap in four columns', () => {
		const spans = planBentoSpans(10);
		expect(spans[0]).toBe('hero');
		expect(spans.some((s) => s === 'wide')).toBe(true);
		const placed = placeSparse(spans, 4);
		expect(placed).toHaveLength(10);
		const cells = new Set<string>();
		for (const item of placed) {
			for (let r = 0; r < item.rowSpan; r++) {
				for (let c = 0; c < item.colSpan; c++) {
					const key = `${item.colStart + c},${item.rowStart + r}`;
					expect(cells.has(key)).toBe(false);
					cells.add(key);
				}
			}
		}
		expect(placed[0]).toMatchObject({ colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 });
	});

	it('keeps source order on one column', () => {
		const placed = placeSparse(planBentoSpans(10), 1);
		placed.forEach((item, index) => {
			expect(item).toMatchObject({ colStart: 1, rowStart: index + 1, colSpan: 1, rowSpan: 1 });
		});
	});

	it('maps spans to CSS class names', () => {
		expect(bentoItemClass('hero')).toContain('qx-bento-hero');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest --run src/lib/ui/bento.spec.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation** in `web/src/lib/ui/bento.ts` (spans, tracks, sparse placer, `planBentoSpans(10)` = hero,wide,wide,unit,unit,wide,wide,unit,unit,wide).

- [ ] **Step 4: Re-run until PASS**

- [ ] **Step 5: Commit** `test+feat: add bento layout helpers`

---

### Task 2: Affordance helpers (RED → GREEN)

**Files:**
- Create: `web/src/lib/ui/affordance.ts`
- Test: `web/src/lib/ui/affordance.spec.ts`

- [ ] Failing tests for `passwordInputType`, `passwordToggleLabel` (显示密码/隐藏密码), `LINK_CLASS` containing underline + primary, `BUTTON_PADDING_INLINE_PX >= 24`, `CONTROL_MIN_PX === 44`.
- [ ] Implement and green.
- [ ] Commit `test+feat: add control affordance helpers`

---

### Task 3: CSS + kit components

**Files:** `web/src/routes/layout.css`, `web/src/lib/components/{Bento,BentoItem,Input,Skeleton,Tabs,Button,Icon}.svelte`, `web/src/routes/kit/+page.svelte`

- [ ] Tokens `--qx-gutter: 1rem`, `--qx-danger` muted; `.qx-bento-host` / `.qx-bento` container queries; `.qx-link`.
- [ ] Input: in-field password toggle.
- [ ] Tabs: `repeat(tabs.length, minmax(0,1fr))`.
- [ ] Button: `px-6`; danger uses `--qx-danger`.
- [ ] Kit documents Bento + password field.
- [ ] Commit `feat(ui): bento kit, password toggle, link affordance`

---

### Task 4: Shell and screens

**Files:** AppShell, home, modules, settings, login, register, `[slug]`, finance/wellness/study homes, elder tools, mood meditate, AI grids, hustle ideas, create inspiration, chrome back-links.

- [ ] Wrap card sections in Bento/BentoItem with `planBentoSpans` or explicit spans.
- [ ] AppShell CTA 打开模块中心; min-inline-size 0 on main.
- [ ] `.qx-link` on 返回模块中心 and auth switchers.
- [ ] Commit `feat(ui): apply bento restyle to existing screens`

---

### Task 5: Playwright + verification

**Files:** `web/e2e/bento.e2e.ts`, `web/e2e/screenshots.e2e.ts` (settings 390/dark)

- [ ] Assert `[data-bento]` on `/` and `/modules`; `scrollWidth <= viewport+1` at 390 and 1280; password toggle; login link underline.
- [ ] `npm test && npm run check && npm run build`
- [ ] Capture home/modules/settings 1280/390 × light/dark to `web/screenshots/` and `/opt/cursor/artifacts/`
- [ ] Archive OpenSpec; push; PR (do not merge)

## Plan self-review

- Spec coverage: bento, container columns, gutter, password, links, skeleton, tabs, home/hub/settings, palette — each has a task.
- No TBD.
- Span names (`hero`/`wide`/`unit`/`full`) consistent across tasks.
