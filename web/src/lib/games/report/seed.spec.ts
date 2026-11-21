import { describe, expect, it } from 'vitest';
import { evaluateBook, numeric, setRaw } from './engine';
import { createSeedBook, TIE_ADDR } from './seed';

describe('annual-report seed statements', () => {
	it('keeps the balance sheet tied on seed data', () => {
		const book = createSeedBook();
		evaluateBook(book);
		for (const col of ['B', 'C', 'D']) {
			expect(Math.abs(numeric(book, '资产负债表', `${col}${TIE_ADDR.row}`))).toBeLessThan(0.05);
			expect(numeric(book, '利润表', `${col}${TIE_ADDR.ni}`)).toBeGreaterThan(100);
			expect(numeric(book, '现金流量表', `${col}${TIE_ADDR.cash}`)).toBeGreaterThan(100);
		}
	});

	it('pushes an assumption edit through income, balance, and cash flow', () => {
		const book = createSeedBook();
		evaluateBook(book);
		const ni = numeric(book, '利润表', `C${TIE_ADDR.ni}`);
		const assets = numeric(book, '资产负债表', `C${TIE_ADDR.assets}`);
		const cash = numeric(book, '现金流量表', `C${TIE_ADDR.cash}`);
		setRaw(book, '假设', 'C6', '0.35');
		evaluateBook(book);
		expect(numeric(book, '利润表', `C${TIE_ADDR.ni}`)).not.toBeCloseTo(ni, 5);
		expect(numeric(book, '资产负债表', `C${TIE_ADDR.assets}`)).not.toBeCloseTo(assets, 5);
		expect(numeric(book, '现金流量表', `C${TIE_ADDR.cash}`)).not.toBeCloseTo(cash, 5);
		expect(Math.abs(numeric(book, '资产负债表', `C${TIE_ADDR.row}`))).toBeLessThan(0.5);
	});
});
