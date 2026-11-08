export const BENTO_GUTTER_PX = 16;

export type BentoSpan = 'unit' | 'wide' | 'hero' | 'full';
export type BentoColumns = 1 | 2 | 4;

export interface BentoPlacement {
	colStart: number;
	rowStart: number;
	colSpan: number;
	rowSpan: number;
}

const SPAN_TRACKS: Record<BentoSpan, { col: number; row: number }> = {
	unit: { col: 1, row: 1 },
	wide: { col: 2, row: 1 },
	hero: { col: 2, row: 2 },
	full: { col: 4, row: 1 }
};

/** Default hub recipe: fills 4-col rows without dense packing. */
const TEN_TILE_RECIPE: BentoSpan[] = [
	'hero',
	'wide',
	'wide',
	'unit',
	'unit',
	'wide',
	'wide',
	'unit',
	'unit',
	'wide'
];

export function tracksForColumns(span: BentoSpan, columns: BentoColumns): { col: number; row: number } {
	if (columns === 1) return { col: 1, row: 1 };
	const raw = SPAN_TRACKS[span];
	if (columns === 2) {
		return { col: Math.min(Math.max(raw.col, 1), 2), row: 1 };
	}
	return { col: Math.min(raw.col, 4), row: raw.row };
}

export function planBentoSpans(count: number): BentoSpan[] {
	if (count <= 0) return [];
	if (count === 4) return ['hero', 'wide', 'unit', 'unit'];
	const spans: BentoSpan[] = [];
	for (let i = 0; i < count; i++) {
		spans.push(TEN_TILE_RECIPE[i % TEN_TILE_RECIPE.length]);
	}
	if (count >= 10) {
		for (let i = 0; i < 10; i++) spans[i] = TEN_TILE_RECIPE[i];
	}
	return spans;
}

export function bentoItemClass(span: BentoSpan): string {
	return `qx-bento-item qx-bento-${span}`;
}

export function placeSparse(spans: BentoSpan[], columns: BentoColumns): BentoPlacement[] {
	const occupied = new Set<string>();
	const key = (c: number, r: number) => `${c},${r}`;
	const result: BentoPlacement[] = [];

	function fits(c: number, r: number, cs: number, rs: number): boolean {
		if (c < 1 || r < 1 || c + cs - 1 > columns) return false;
		for (let rr = r; rr < r + rs; rr++) {
			for (let cc = c; cc < c + cs; cc++) {
				if (occupied.has(key(cc, rr))) return false;
			}
		}
		return true;
	}

	function occupy(c: number, r: number, cs: number, rs: number) {
		for (let rr = r; rr < r + rs; rr++) {
			for (let cc = c; cc < c + cs; cc++) {
				occupied.add(key(cc, rr));
			}
		}
	}

	for (const span of spans) {
		const { col: cs, row: rs } = tracksForColumns(span, columns);
		let placed: BentoPlacement | null = null;
		for (let r = 1; r < 200 && !placed; r++) {
			for (let c = 1; c <= columns && !placed; c++) {
				if (fits(c, r, cs, rs)) {
					occupy(c, r, cs, rs);
					placed = { colStart: c, rowStart: r, colSpan: cs, rowSpan: rs };
				}
			}
		}
		if (!placed) {
			throw new Error(`bento: could not place ${span} in ${columns} columns`);
		}
		result.push(placed);
	}

	return result;
}
