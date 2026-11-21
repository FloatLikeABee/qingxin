export type SheetMode = 'light' | 'dark';

export type SheetSwatch = {
	paper: string;
	paperAlt: string;
	ink: string;
	muted: string;
	header: string;
	gutter: string;
	gutterInk: string;
	line: string;
	formulaBg: string;
	formulaInk: string;
	inputBg: string;
	barBg: string;
	errorInk: string;
	errorBg: string;
	selectBg: string;
	selectLine: string;
	hl: string;
	warn: string;
};

/** Light worksheet: cream paper, near-black ink. Independent of glass tokens. */
export const SHEET_LIGHT: SheetSwatch = {
	paper: '#fff8ee',
	paperAlt: '#f0e2cc',
	ink: '#1c1917',
	muted: '#4a433c',
	header: '#e4d3b4',
	gutter: '#e8d9c0',
	gutterInk: '#3f3a34',
	line: '#c4b194',
	formulaBg: '#eef3fa',
	formulaInk: '#1e3a5f',
	inputBg: '#fffdf8',
	barBg: '#fffdf8',
	errorInk: '#9f1239',
	errorBg: '#fce7ea',
	selectBg: '#d7e6fb',
	selectLine: '#1d4ed8',
	hl: '#d9e8fa',
	warn: '#f8e7b8'
};

/** Dark worksheet: walnut paper, cream ink. Independent of glass tokens. */
export const SHEET_DARK: SheetSwatch = {
	paper: '#1b1714',
	paperAlt: '#241e18',
	ink: '#f4ebe0',
	muted: '#d9cbb6',
	header: '#2c261e',
	gutter: '#2c261e',
	gutterInk: '#d9cbb6',
	line: '#5c4f3e',
	formulaBg: '#1a2433',
	formulaInk: '#d5e4f7',
	inputBg: '#221c16',
	barBg: '#221c16',
	errorInk: '#fecaca',
	errorBg: '#4a1520',
	selectBg: '#1e3a5f',
	selectLine: '#93c5fd',
	hl: '#243044',
	warn: '#3f3518'
};

export function sheetSwatch(mode: SheetMode): SheetSwatch {
	return mode === 'dark' ? SHEET_DARK : SHEET_LIGHT;
}

export function sheetStyle(mode: SheetMode): string {
	const s = sheetSwatch(mode);
	return [
		`--sheet-paper:${s.paper}`,
		`--sheet-paper-alt:${s.paperAlt}`,
		`--sheet-ink:${s.ink}`,
		`--sheet-muted:${s.muted}`,
		`--sheet-header:${s.header}`,
		`--sheet-gutter:${s.gutter}`,
		`--sheet-gutter-ink:${s.gutterInk}`,
		`--sheet-line:${s.line}`,
		`--sheet-formula-bg:${s.formulaBg}`,
		`--sheet-formula-ink:${s.formulaInk}`,
		`--sheet-input-bg:${s.inputBg}`,
		`--sheet-bar-bg:${s.barBg}`,
		`--sheet-error:${s.errorInk}`,
		`--sheet-error-bg:${s.errorBg}`,
		`--sheet-select:${s.selectBg}`,
		`--sheet-select-line:${s.selectLine}`,
		`--sheet-hl:${s.hl}`,
		`--sheet-warn:${s.warn}`
	].join(';');
}

function channel(c: number) {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
	const n = hex.replace('#', '');
	const r = parseInt(n.slice(0, 2), 16);
	const g = parseInt(n.slice(2, 4), 16);
	const b = parseInt(n.slice(4, 6), 16);
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	const hi = Math.max(a, b);
	const lo = Math.min(a, b);
	return (hi + 0.05) / (lo + 0.05);
}

export function contrastPairs(mode: SheetMode): { name: string; fg: string; bg: string }[] {
	const s = sheetSwatch(mode);
	return [
		{ name: 'ink/paper', fg: s.ink, bg: s.paper },
		{ name: 'ink/alt', fg: s.ink, bg: s.paperAlt },
		{ name: 'ink/header', fg: s.ink, bg: s.header },
		{ name: 'gutter', fg: s.gutterInk, bg: s.gutter },
		{ name: 'formula', fg: s.formulaInk, bg: s.formulaBg },
		{ name: 'formula-on-paper', fg: s.ink, bg: s.formulaBg },
		{ name: 'input', fg: s.ink, bg: s.inputBg },
		{ name: 'bar', fg: s.ink, bg: s.barBg },
		{ name: 'muted', fg: s.muted, bg: s.paper },
		{ name: 'placeholder', fg: s.muted, bg: s.barBg },
		{ name: 'error', fg: s.errorInk, bg: s.errorBg },
		{ name: 'error-on-paper', fg: s.errorInk, bg: s.paper },
		{ name: 'select', fg: s.ink, bg: s.selectBg },
		{ name: 'highlight', fg: s.ink, bg: s.hl },
		{ name: 'warn', fg: s.ink, bg: s.warn }
	];
}

export function fillTone(fill?: string): 'hl' | 'warn' | '' {
	if (fill === '#dbeafe') return 'hl';
	if (fill === '#fef3c7') return 'warn';
	return '';
}
