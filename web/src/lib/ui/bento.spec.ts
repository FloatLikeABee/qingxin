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

	it('uses a hero-wide-unit recipe for four tiles', () => {
		expect(planBentoSpans(4)).toEqual(['hero', 'wide', 'unit', 'unit']);
	});

	it('caps two-column tracks so wide and hero share a row pair', () => {
		expect(tracksForColumns('hero', 2)).toEqual({ col: 2, row: 1 });
		expect(tracksForColumns('full', 2)).toEqual({ col: 2, row: 1 });
	});

	it('does not require dense packing for the default ten-tile recipe', () => {
		const placed = placeSparse(planBentoSpans(10), 4);
		for (let i = 1; i < placed.length; i++) {
			const prev = placed[i - 1];
			const cur = placed[i];
			const prevKey = prev.rowStart * 10 + prev.colStart;
			const curKey = cur.rowStart * 10 + cur.colStart;
			expect(curKey).toBeGreaterThan(prevKey);
		}
	});
});
