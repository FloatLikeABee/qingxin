import { a1, parseRef, shiftRef } from './addr';
import { getCell, getSheet, setRaw, type NumFmt, type Workbook } from './engine';

const UNDO_CAP = 50;

function normSel(book: Workbook) {
	const s = book.selection;
	return {
		sheet: s.sheet,
		r0: Math.min(s.r0, s.r1),
		c0: Math.min(s.c0, s.c1),
		r1: Math.max(s.r0, s.r1),
		c1: Math.max(s.c0, s.c1)
	};
}

function pushPatch(
	book: Workbook,
	changes: { sheet: string; addr: string; prev: string; next: string }[]
) {
	const meaningful = changes.filter((c) => c.prev !== c.next);
	if (!meaningful.length) return;
	book.undo.push({ changes: meaningful });
	if (book.undo.length > UNDO_CAP) book.undo.shift();
	book.redo = [];
}

export function applyEdit(book: Workbook, sheetName: string, addr: string, raw: string) {
	const sheet = getSheet(book, sheetName);
	if (!sheet) return;
	const key = addr.toUpperCase();
	const prev = sheet.cells[key]?.raw ?? '';
	setRaw(book, sheetName, key, raw);
	pushPatch(book, [{ sheet: sheetName, addr: key, prev, next: raw }]);
}

export function undoEdit(book: Workbook) {
	const patch = book.undo.pop();
	if (!patch) return;
	for (const change of patch.changes) setRaw(book, change.sheet, change.addr, change.prev);
	book.redo.push(patch);
}

export function redoEdit(book: Workbook) {
	const patch = book.redo.pop();
	if (!patch) return;
	for (const change of patch.changes) setRaw(book, change.sheet, change.addr, change.next);
	book.undo.push(patch);
}

export function copyTsv(book: Workbook): string {
	const sel = normSel(book);
	const sheet = getSheet(book, sel.sheet);
	if (!sheet) return '';
	const lines: string[] = [];
	for (let r = sel.r0; r <= sel.r1; r++) {
		const row: string[] = [];
		for (let c = sel.c0; c <= sel.c1; c++) {
			row.push(sheet.cells[a1(r, c)]?.raw ?? '');
		}
		lines.push(row.join('\t'));
	}
	return lines.join('\n');
}

function shiftFormula(raw: string, sheet: string, dCol: number, dRow: number): string {
	if (!raw.startsWith('=')) return raw;
	return raw.replace(/(?:[^!+\-*/(),:<>=]+!)?\$?[A-Za-z]+\$?\d+/g, (token) => {
		if (!parseRef(token, sheet)) return token;
		return shiftRef(token, sheet, dCol, dRow);
	});
}

export function pasteTsv(book: Workbook, tsv: string) {
	const sel = normSel(book);
	const sheet = getSheet(book, sel.sheet);
	if (!sheet) return;
	const rows = tsv.replace(/\r/g, '').split('\n');
	const changes: { sheet: string; addr: string; prev: string; next: string }[] = [];
	rows.forEach((line, dr) => {
		line.split('\t').forEach((cell, dc) => {
			const r = sel.r0 + dr;
			const c = sel.c0 + dc;
			if (r >= sheet.rows || c >= sheet.cols) return;
			const addr = a1(r, c);
			const prev = sheet.cells[addr]?.raw ?? '';
			const next = shiftFormula(cell, sel.sheet, dc, dr);
			setRaw(book, sel.sheet, addr, next);
			changes.push({ sheet: sel.sheet, addr, prev, next });
		});
	});
	pushPatch(book, changes);
}

export function formatSel(
	book: Workbook,
	opts: { bold?: boolean; numFmt?: NumFmt; fill?: string }
) {
	const sel = normSel(book);
	const sheet = getSheet(book, sel.sheet);
	if (!sheet) return;
	for (let r = sel.r0; r <= sel.r1; r++) {
		for (let c = sel.c0; c <= sel.c1; c++) {
			const addr = a1(r, c);
			const cell = getCell(sheet, addr) ?? { raw: '' };
			sheet.cells[addr] = {
				...cell,
				bold: opts.bold ?? cell.bold,
				numFmt: opts.numFmt ?? cell.numFmt,
				fill: opts.fill ?? cell.fill
			};
		}
	}
}

export function insertRow(book: Workbook) {
	const sheet = getSheet(book, book.active);
	if (!sheet || sheet.rows >= 200) return;
	sheet.rows += 1;
}

export function emptyUndo(book: Workbook) {
	book.undo = [];
	book.redo = [];
}
