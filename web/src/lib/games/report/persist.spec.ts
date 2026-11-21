import { describe, expect, it } from 'vitest';
import { numeric } from './engine';
import { REPORT_SAVE_KEY, REPORT_SCHEMA, readReportSave, writeReportSave } from './persist';
import { applyEdit } from './book';
import { TIE_ADDR } from './seed';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('annual-report save', () => {
	it('round-trips an assumption edit without wiping sibling keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.cargo-haul': '{"schema":1}'
		});
		const book = readReportSave(storage);
		applyEdit(book, '假设', 'C6', '0.3');
		writeReportSave(book, storage);
		const loaded = readReportSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.sheets[0]!.cells.C6?.raw).toBe('0.3');
		expect(numeric(loaded, '利润表', `C${TIE_ADDR.ni}`)).toBeGreaterThan(100);
		expect(REPORT_SCHEMA).toBe(1);
		expect(REPORT_SAVE_KEY).toBe('qingxin.games.annual-report');
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.cargo-haul')).toBe('{"schema":1}');
	});

	it('skips oversized writes without wiping sibling keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.tide-breath': '{"schema":1}'
		});
		const book = readReportSave(storage);
		book.sheets[0]!.cells.Z1 = { raw: 'x'.repeat(401_000) };
		writeReportSave(book, storage);
		expect(storage.getItem(REPORT_SAVE_KEY)).toBeNull();
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.tide-breath')).toBe('{"schema":1}');
	});

	it('recovers corrupt and foreign schema without wiping theme', () => {
		const storage = memory({
			'qingxin.theme': 'light',
			'qingxin.games.annual-report': '{nope'
		});
		const bad = readReportSave(storage);
		expect(bad.recovered).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('light');
		storage.setItem('qingxin.games.annual-report', JSON.stringify({ schema: 99 }));
		const foreign = readReportSave(storage);
		expect(foreign.recovered).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('light');
	});
});
