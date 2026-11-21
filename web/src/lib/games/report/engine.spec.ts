import { describe, expect, it } from 'vitest';
import { a1, cellKey, colToIndex, indexToCol } from './addr';
import { parseFormula } from './parse';
import { displayCell, evaluateBook, makeSheet, numeric, setRaw, type Workbook } from './engine';

function book(cells: Record<string, string>, name = '假设'): Workbook {
	const sheet = makeSheet('assume', name, 20, 8);
	for (const [addr, raw] of Object.entries(cells)) {
		sheet.cells[addr] = { raw };
	}
	return {
		title: '年报',
		company: '青柠示意有限公司',
		sheets: [sheet],
		active: name,
		values: {},
		notice: '',
		recovered: false,
		dockCollapsed: false,
		selection: { sheet: name, r0: 0, c0: 0, r1: 0, c1: 0 },
		undo: [],
		redo: []
	};
}

describe('annual-report addresses', () => {
	it('round-trips A1 and AA26', () => {
		expect(indexToCol(0)).toBe('A');
		expect(colToIndex('B')).toBe(1);
		expect(a1(0, 0)).toBe('A1');
		expect(a1(25, 26)).toBe('AA26');
		expect(cellKey('假设', 'B4')).toBe('假设!B4');
	});
});

describe('annual-report formula DAG', () => {
	it('adds, multiplies, and sums a range', () => {
		const wb = book({
			A1: '2',
			A2: '3',
			A3: '=A1+A2*4',
			A4: '=SUM(A1:A2)'
		});
		evaluateBook(wb);
		expect(numeric(wb, '假设', 'A3')).toBe(14);
		expect(numeric(wb, '假设', 'A4')).toBe(5);
		expect(displayCell(wb, '假设', 'A3')).toBe('14');
	});

	it('resolves AVERAGE MIN MAX IF ROUND ABS and sheet refs', () => {
		const assume = makeSheet('assume', '假设', 12, 4);
		assume.cells.B2 = { raw: '10' };
		assume.cells.B3 = { raw: '30' };
		const income = makeSheet('is', '利润表', 12, 4);
		income.cells.B2 = { raw: '=AVERAGE(假设!B2:B3)' };
		income.cells.B3 = { raw: '=IF(B2>15,ROUND(MAX(假设!B2:B3)/ABS(-4),1),MIN(假设!B2:B3))' };
		const wb: Workbook = {
			title: '年报',
			company: '青柠示意有限公司',
			sheets: [assume, income],
			active: '利润表',
			values: {},
			notice: '',
			recovered: false,
			dockCollapsed: false,
			selection: { sheet: '利润表', r0: 0, c0: 0, r1: 0, c1: 0 },
			undo: [],
			redo: []
		};
		evaluateBook(wb);
		expect(numeric(wb, '利润表', 'B2')).toBe(20);
		expect(numeric(wb, '利润表', 'B3')).toBe(7.5);
	});

	it('surfaces parse, name, ref, div0, and cycle errors without eval', () => {
		const wb = book({
			A1: '=2+',
			A2: '=FOO(1)',
			A3: '=ZZ99',
			A4: '=1/0',
			A5: '=A6+1',
			A6: '=A5+1',
			A7: '=constructor.constructor("return 1")()'
		});
		evaluateBook(wb);
		expect(displayCell(wb, '假设', 'A1')).toBe('#PARSE!');
		expect(displayCell(wb, '假设', 'A2')).toBe('#NAME?');
		expect(displayCell(wb, '假设', 'A3')).toBe('#REF!');
		expect(displayCell(wb, '假设', 'A4')).toBe('#DIV/0!');
		expect(displayCell(wb, '假设', 'A5')).toBe('#CYCLE!');
		expect(displayCell(wb, '假设', 'A6')).toBe('#CYCLE!');
		expect(displayCell(wb, '假设', 'A7')).toBe('#PARSE!');
		expect(parseFormula('=SUM(A1:A2)', '假设').ok).toBe(true);
	});

	it('setRaw dirties dependents across sheets', () => {
		const assume = makeSheet('assume', '假设', 8, 4);
		assume.cells.B4 = { raw: '0.1' };
		const income = makeSheet('is', '利润表', 8, 4);
		income.cells.B8 = { raw: '=100*(1+假设!B4)' };
		const wb: Workbook = {
			title: '年报',
			company: '青柠示意有限公司',
			sheets: [assume, income],
			active: '假设',
			values: {},
			notice: '',
			recovered: false,
			dockCollapsed: false,
			selection: { sheet: '假设', r0: 0, c0: 0, r1: 0, c1: 0 },
			undo: [],
			redo: []
		};
		evaluateBook(wb);
		expect(numeric(wb, '利润表', 'B8')).toBe(110);
		setRaw(wb, '假设', 'B4', '0.2');
		evaluateBook(wb);
		expect(numeric(wb, '利润表', 'B8')).toBe(120);
	});
});
