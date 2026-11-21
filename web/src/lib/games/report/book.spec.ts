import { describe, expect, it } from 'vitest';
import { displayCell, evaluateBook } from './engine';
import { applyEdit, copyTsv, formatSel, insertRow, pasteTsv, redoEdit, undoEdit } from './book';
import { createSeedBook } from './seed';

describe('annual-report editing', () => {
	it('undoes and redoes a cell edit', () => {
		const book = createSeedBook();
		evaluateBook(book);
		const before = book.sheets[0]!.cells.C6?.raw;
		applyEdit(book, '假设', 'C6', '0.4');
		evaluateBook(book);
		expect(book.sheets[0]!.cells.C6?.raw).toBe('0.4');
		undoEdit(book);
		evaluateBook(book);
		expect(book.sheets[0]!.cells.C6?.raw).toBe(before);
		expect(displayCell(book, '假设', 'C6')).not.toBe('#PARSE!');
		redoEdit(book);
		evaluateBook(book);
		expect(book.sheets[0]!.cells.C6?.raw).toBe('0.4');
	});

	it('pastes TSV and restores with undo', () => {
		const book = createSeedBook();
		const prev = book.sheets[0]!.cells.B7?.raw;
		book.selection = { sheet: '假设', r0: 6, c0: 1, r1: 6, c1: 2 };
		pasteTsv(book, '1\t2');
		evaluateBook(book);
		expect(book.sheets[0]!.cells.B7?.raw).toBe('1');
		expect(book.sheets[0]!.cells.C7?.raw).toBe('2');
		expect(copyTsv(book)).toContain('1');
		undoEdit(book);
		expect(book.sheets[0]!.cells.B7?.raw).toBe(prev);
	});

	it('inserts a row until the 200 cap', () => {
		const book = createSeedBook();
		const rows = book.sheets[0]!.rows;
		insertRow(book);
		expect(book.sheets[0]!.rows).toBe(rows + 1);
		book.sheets[0]!.rows = 200;
		insertRow(book);
		expect(book.sheets[0]!.rows).toBe(200);
	});

	it('applies number format and bold on the selection', () => {
		const book = createSeedBook();
		book.selection = { sheet: '假设', r0: 5, c0: 1, r1: 5, c1: 1 };
		formatSel(book, { bold: true, numFmt: 'percent' });
		expect(book.sheets[0]!.cells.B6?.bold).toBe(true);
		expect(book.sheets[0]!.cells.B6?.numFmt).toBe('percent');
	});
});
