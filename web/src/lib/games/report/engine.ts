import { a1, cellKey } from './addr';
import { collectRefs, parseFormula, type ErrorCode, type Expr } from './parse';

export type NumFmt = 'number' | 'percent' | 'decimal2' | 'text';

export type Cell = {
	raw: string;
	numFmt?: NumFmt;
	bold?: boolean;
	fill?: string;
};

export type Sheet = {
	id: string;
	name: string;
	rows: number;
	cols: number;
	cells: Record<string, Cell>;
};

export type CellValue = { k: 'n'; n: number } | { k: 's'; s: string } | { k: 'e'; e: ErrorCode };

export type Selection = {
	sheet: string;
	r0: number;
	c0: number;
	r1: number;
	c1: number;
};

export type Patch = {
	changes: { sheet: string; addr: string; prev: string; next: string }[];
};

export type Workbook = {
	title: string;
	company: string;
	sheets: Sheet[];
	active: string;
	values: Record<string, CellValue>;
	notice: string;
	recovered: boolean;
	dockCollapsed: boolean;
	selection: Selection;
	undo: Patch[];
	redo: Patch[];
};

export function makeSheet(id: string, name: string, rows: number, cols: number): Sheet {
	return { id, name, rows, cols, cells: {} };
}

export function getSheet(book: Workbook, name: string): Sheet | undefined {
	return book.sheets.find((s) => s.name === name || s.id === name);
}

export function getCell(sheet: Sheet, addr: string): Cell | undefined {
	return sheet.cells[addr.toUpperCase()];
}

export function setRaw(book: Workbook, sheetName: string, addr: string, raw: string) {
	const sheet = getSheet(book, sheetName);
	if (!sheet) return;
	const key = addr.toUpperCase();
	const prev = sheet.cells[key];
	if (!raw) {
		delete sheet.cells[key];
		return;
	}
	sheet.cells[key] = { ...(prev ?? { raw: '' }), raw };
}

function asNum(v: CellValue): CellValue {
	if (v.k === 'e') return v;
	if (v.k === 'n') return v;
	if (v.s === '') return { k: 'n', n: 0 };
	const n = Number(v.s);
	if (!Number.isFinite(n)) return { k: 'e', e: '#VALUE!' };
	return { k: 'n', n };
}

function flatten(expr: Expr, values: Record<string, CellValue>, book: Workbook): CellValue {
	if (expr.kind === 'num') return { k: 'n', n: expr.n };
	if (expr.kind === 'str') return { k: 's', s: expr.s };
	if (expr.kind === 'err') return { k: 'e', e: expr.code };
	if (expr.kind === 'neg') {
		const v = asNum(flatten(expr.expr, values, book));
		if (v.k !== 'n') return v;
		return { k: 'n', n: -v.n };
	}
	if (expr.kind === 'ref') {
		const sheet = getSheet(book, expr.ref.sheet);
		if (!sheet || expr.ref.row >= sheet.rows || expr.ref.col >= sheet.cols)
			return { k: 'e', e: '#REF!' };
		return values[cellKey(expr.ref.sheet, expr.ref.a1)] ?? { k: 'n', n: 0 };
	}
	if (expr.kind === 'range') return { k: 'e', e: '#VALUE!' };
	if (expr.kind === 'op') {
		const l = asNum(flatten(expr.left, values, book));
		const r = asNum(flatten(expr.right, values, book));
		if (l.k !== 'n') return l;
		if (r.k !== 'n') return r;
		if (expr.op === '/' && r.n === 0) return { k: 'e', e: '#DIV/0!' };
		const n =
			expr.op === '+'
				? l.n + r.n
				: expr.op === '-'
					? l.n - r.n
					: expr.op === '*'
						? l.n * r.n
						: expr.op === '/'
							? l.n / r.n
							: expr.op === '>'
								? l.n > r.n
									? 1
									: 0
								: expr.op === '<'
									? l.n < r.n
										? 1
										: 0
									: expr.op === '>='
										? l.n >= r.n
											? 1
											: 0
										: expr.op === '<='
											? l.n <= r.n
												? 1
												: 0
											: expr.op === '<>'
												? l.n !== r.n
													? 1
													: 0
												: l.n === r.n
													? 1
													: 0;
		return { k: 'n', n: Number(n.toPrecision(12)) };
	}
	if (expr.kind === 'call') return callFn(expr.name, expr.args, values, book);
	return { k: 'e', e: '#PARSE!' };
}

function numsIn(
	args: Expr[],
	values: Record<string, CellValue>,
	book: Workbook
): (CellValue & { k: 'n' }) | CellValue {
	const out: number[] = [];
	const walk = (expr: Expr): CellValue | null => {
		if (expr.kind === 'range') {
			const r0 = Math.min(expr.start.row, expr.end.row);
			const r1 = Math.max(expr.start.row, expr.end.row);
			const c0 = Math.min(expr.start.col, expr.end.col);
			const c1 = Math.max(expr.start.col, expr.end.col);
			const sheet = getSheet(book, expr.start.sheet);
			if (!sheet) return { k: 'e', e: '#REF!' };
			for (let r = r0; r <= r1; r++) {
				for (let c = c0; c <= c1; c++) {
					if (r >= sheet.rows || c >= sheet.cols) return { k: 'e', e: '#REF!' };
					const v = values[cellKey(sheet.name, a1(r, c))] ?? { k: 'n', n: 0 };
					if (v.k === 'e') return v;
					if (v.k === 'n') out.push(v.n);
				}
			}
			return null;
		}
		const v = flatten(expr, values, book);
		if (v.k === 'e') return v;
		if (v.k === 'n') out.push(v.n);
		return null;
	};
	for (const arg of args) {
		const err = walk(arg);
		if (err) return err;
	}
	return { k: 'n', n: out.length };
}

function callFn(
	name: string,
	args: Expr[],
	values: Record<string, CellValue>,
	book: Workbook
): CellValue {
	if (name === 'ABS') {
		const v = asNum(flatten(args[0] ?? { kind: 'err', code: '#VALUE!' }, values, book));
		if (v.k !== 'n') return v;
		return { k: 'n', n: Math.abs(v.n) };
	}
	if (name === 'ROUND') {
		const v = asNum(flatten(args[0] ?? { kind: 'err', code: '#VALUE!' }, values, book));
		const d = asNum(flatten(args[1] ?? { kind: 'num', n: 0 }, values, book));
		if (v.k !== 'n') return v;
		if (d.k !== 'n') return d;
		const f = 10 ** d.n;
		return { k: 'n', n: Math.round(v.n * f) / f };
	}
	if (name === 'IF') {
		const cond = flatten(args[0] ?? { kind: 'err', code: '#VALUE!' }, values, book);
		if (cond.k === 'e') return cond;
		const truth = cond.k === 'n' ? cond.n !== 0 : cond.k === 's' ? cond.s !== '' : false;
		return flatten((truth ? args[1] : args[2]) ?? { kind: 'num', n: 0 }, values, book);
	}
	const packed = numsIn(args, values, book);
	if (packed.k !== 'n') return packed;
	const list: number[] = [];
	const collect = (expr: Expr) => {
		if (expr.kind === 'range') {
			const r0 = Math.min(expr.start.row, expr.end.row);
			const r1 = Math.max(expr.start.row, expr.end.row);
			const c0 = Math.min(expr.start.col, expr.end.col);
			const c1 = Math.max(expr.start.col, expr.end.col);
			const sheet = getSheet(book, expr.start.sheet);
			if (!sheet) return;
			for (let r = r0; r <= r1; r++) {
				for (let c = c0; c <= c1; c++) {
					const v = values[cellKey(sheet.name, a1(r, c))];
					if (v?.k === 'n') list.push(v.n);
				}
			}
			return;
		}
		const v = flatten(expr, values, book);
		if (v.k === 'n') list.push(v.n);
	};
	for (const arg of args) collect(arg);
	if (name === 'SUM') return { k: 'n', n: list.reduce((a, b) => a + b, 0) };
	if (name === 'AVERAGE')
		return list.length
			? { k: 'n', n: list.reduce((a, b) => a + b, 0) / list.length }
			: { k: 'e', e: '#DIV/0!' };
	if (name === 'MIN')
		return list.length ? { k: 'n', n: Math.min(...list) } : { k: 'e', e: '#VALUE!' };
	if (name === 'MAX')
		return list.length ? { k: 'n', n: Math.max(...list) } : { k: 'e', e: '#VALUE!' };
	return { k: 'e', e: '#NAME?' };
}

export function evaluateBook(book: Workbook) {
	const values: Record<string, CellValue> = {};
	type Node = { key: string; sheet: string; addr: string; raw: string; deps: string[] };
	const nodes: Node[] = [];
	const byKey = new Map<string, Node>();
	for (const sheet of book.sheets) {
		for (let r = 0; r < sheet.rows; r++) {
			for (let c = 0; c < sheet.cols; c++) {
				const addr = a1(r, c);
				const raw = sheet.cells[addr]?.raw ?? '';
				const key = cellKey(sheet.name, addr);
				if (!raw.startsWith('=')) {
					if (raw === '') values[key] = { k: 'n', n: 0 };
					else if (Number.isFinite(Number(raw)) && raw.trim() !== '')
						values[key] = { k: 'n', n: Number(raw) };
					else values[key] = { k: 's', s: raw };
					continue;
				}
				const parsed = parseFormula(raw, sheet.name);
				if (!parsed.ok) {
					values[key] = { k: 'e', e: parsed.code };
					continue;
				}
				const deps = collectRefs(parsed.expr).map((ref) => cellKey(ref.sheet, ref.a1));
				const node = { key, sheet: sheet.name, addr, raw, deps };
				nodes.push(node);
				byKey.set(key, node);
			}
		}
	}
	const indeg = new Map<string, number>();
	const adj = new Map<string, string[]>();
	for (const node of nodes) {
		indeg.set(node.key, 0);
		adj.set(node.key, []);
	}
	for (const node of nodes) {
		for (const dep of node.deps) {
			if (!byKey.has(dep)) continue;
			adj.get(dep)!.push(node.key);
			indeg.set(node.key, (indeg.get(node.key) ?? 0) + 1);
		}
	}
	const queue = nodes.filter((n) => (indeg.get(n.key) ?? 0) === 0).map((n) => n.key);
	const order: string[] = [];
	while (queue.length) {
		const key = queue.shift()!;
		order.push(key);
		for (const next of adj.get(key) ?? []) {
			const d = (indeg.get(next) ?? 1) - 1;
			indeg.set(next, d);
			if (d === 0) queue.push(next);
		}
	}
	const cyclic = new Set(nodes.map((n) => n.key).filter((k) => !order.includes(k)));
	for (const key of cyclic) values[key] = { k: 'e', e: '#CYCLE!' };
	for (const key of order) {
		const node = byKey.get(key)!;
		const parsed = parseFormula(node.raw, node.sheet);
		if (!parsed.ok) {
			values[key] = { k: 'e', e: parsed.code };
			continue;
		}
		values[key] = flatten(parsed.expr, values, book);
	}
	book.values = values;
}

export function numeric(book: Workbook, sheet: string, addr: string): number {
	const v = book.values[cellKey(sheet, addr.toUpperCase())];
	if (v?.k === 'n') return v.n;
	return NaN;
}

export function cellKind(book: Workbook, sheetName: string, addr: string) {
	const sheet = getSheet(book, sheetName);
	const raw = sheet?.cells[addr.toUpperCase()]?.raw ?? '';
	const v = book.values[cellKey(sheetName, addr.toUpperCase())];
	if (v?.k === 'e') return 'error' as const;
	if (!raw) return 'empty' as const;
	if (raw.startsWith('=')) return 'formula' as const;
	return 'input' as const;
}

export function displayCell(book: Workbook, sheetName: string, addr: string): string {
	const sheet = getSheet(book, sheetName);
	const cell = sheet?.cells[addr.toUpperCase()];
	const v = book.values[cellKey(sheetName, addr.toUpperCase())];
	if (v?.k === 'e') return v.e;
	if (v?.k === 's') return v.s;
	if (v?.k === 'n') {
		if (!cell?.raw && v.n === 0) return '';
		const fmt = cell?.numFmt;
		if (fmt === 'percent') return `${(v.n * 100).toFixed(1)}%`;
		if (fmt === 'decimal2') return v.n.toFixed(2);
		if (fmt === 'text') return cell?.raw ?? String(v.n);
		if (Number.isInteger(v.n)) return String(v.n);
		return String(Math.round(v.n * 1000) / 1000);
	}
	return cell?.raw ?? '';
}
