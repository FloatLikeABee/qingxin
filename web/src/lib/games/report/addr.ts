export function colToIndex(letters: string): number {
	let n = 0;
	for (const ch of letters.toUpperCase()) {
		if (ch < 'A' || ch > 'Z') return -1;
		n = n * 26 + (ch.charCodeAt(0) - 64);
	}
	return n - 1;
}

export function indexToCol(index: number): string {
	let n = index + 1;
	let s = '';
	while (n > 0) {
		const r = (n - 1) % 26;
		s = String.fromCharCode(65 + r) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

export function a1(row: number, col: number): string {
	return `${indexToCol(col)}${row + 1}`;
}

export function cellKey(sheet: string, addr: string): string {
	return `${sheet}!${addr.toUpperCase()}`;
}

export type AbsRef = {
	sheet: string;
	row: number;
	col: number;
	absRow: boolean;
	absCol: boolean;
	a1: string;
};

const REF_RE = /^(?:([^!]+)!)?(\$?)([A-Za-z]+)(\$?)(\d+)$/;

export function parseRef(token: string, currentSheet: string): AbsRef | null {
	const m = String(token).trim().match(REF_RE);
	if (!m) return null;
	const col = colToIndex(m[3]!);
	const row = Number(m[5]) - 1;
	if (col < 0 || row < 0 || !Number.isFinite(row)) return null;
	const letters = m[3]!.toUpperCase();
	return {
		sheet: m[1] || currentSheet,
		row,
		col,
		absCol: m[2] === '$',
		absRow: m[4] === '$',
		a1: `${letters}${row + 1}`
	};
}

export function shiftRef(token: string, currentSheet: string, dCol: number, dRow: number): string {
	const ref = parseRef(token, currentSheet);
	if (!ref) return token;
	const col = ref.absCol ? ref.col : Math.max(0, ref.col + dCol);
	const row = ref.absRow ? ref.row : Math.max(0, ref.row + dRow);
	const colPart = `${ref.absCol ? '$' : ''}${indexToCol(col)}`;
	const rowPart = `${ref.absRow ? '$' : ''}${row + 1}`;
	const sheetPart = token.includes('!') ? `${ref.sheet}!` : '';
	return `${sheetPart}${colPart}${rowPart}`;
}
