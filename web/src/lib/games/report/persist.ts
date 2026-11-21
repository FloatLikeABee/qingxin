import { evaluateBook, type Cell, type Sheet, type Workbook } from './engine';
import { createSeedBook } from './seed';

export const REPORT_SAVE_KEY = 'qingxin.games.annual-report';
export const REPORT_SCHEMA = 1;
const SIZE_CAP = 400_000;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseCell(raw: unknown): Cell | null {
	const rec = asRecord(raw);
	if (!rec || typeof rec.raw !== 'string') return null;
	const cell: Cell = { raw: rec.raw.slice(0, 240) };
	if (rec.bold === true) cell.bold = true;
	if (
		rec.numFmt === 'percent' ||
		rec.numFmt === 'decimal2' ||
		rec.numFmt === 'number' ||
		rec.numFmt === 'text'
	)
		cell.numFmt = rec.numFmt;
	if (typeof rec.fill === 'string' && rec.fill.startsWith('#') && rec.fill.length <= 9)
		cell.fill = rec.fill;
	return cell;
}

export function serializeReport(book: Workbook) {
	return {
		schema: REPORT_SCHEMA,
		title: book.title,
		company: book.company,
		active: book.active,
		dockCollapsed: book.dockCollapsed,
		sheets: book.sheets.map((sheet) => ({
			id: sheet.id,
			name: sheet.name,
			rows: sheet.rows,
			cols: sheet.cols,
			cells: sheet.cells
		}))
	};
}

export function writeReportSave(
	book: Workbook,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		const payload = JSON.stringify(serializeReport(book));
		if (payload.length > SIZE_CAP) return;
		storage?.setItem(REPORT_SAVE_KEY, payload);
	} catch {
		// private mode / quota
	}
}

function clampSheet(raw: unknown, fallback: Sheet): Sheet {
	const rec = asRecord(raw);
	if (!rec) return fallback;
	const rows = Math.min(200, Math.max(8, Number(rec.rows) || fallback.rows));
	const cols = Math.min(26, Math.max(4, Number(rec.cols) || fallback.cols));
	const cells: Record<string, Cell> = {};
	const src = asRecord(rec.cells);
	if (src) {
		for (const [addr, value] of Object.entries(src)) {
			if (!/^[A-Z]+[0-9]+$/.test(addr)) continue;
			const cell = parseCell(value);
			if (cell) cells[addr] = cell;
		}
	}
	return {
		id: typeof rec.id === 'string' ? rec.id.slice(0, 20) : fallback.id,
		name: typeof rec.name === 'string' ? rec.name.slice(0, 20) : fallback.name,
		rows,
		cols,
		cells
	};
}

export function readReportSave(
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): Workbook {
	const fresh = createSeedBook();
	try {
		const raw = storage?.getItem(REPORT_SAVE_KEY);
		if (!raw) {
			evaluateBook(fresh);
			return fresh;
		}
		if (raw.length > SIZE_CAP) {
			fresh.recovered = true;
			fresh.notice = '年报太大，已回到示例表。';
			evaluateBook(fresh);
			return fresh;
		}
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== REPORT_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '年报读不出来，已回到示例表。其它轻心数据没动。';
			evaluateBook(fresh);
			return fresh;
		}
		const sheetsRaw = Array.isArray(rec.sheets) ? rec.sheets : [];
		fresh.sheets = fresh.sheets.map((sheet, i) => clampSheet(sheetsRaw[i], sheet));
		if (typeof rec.active === 'string' && fresh.sheets.some((s) => s.name === rec.active))
			fresh.active = rec.active;
		fresh.dockCollapsed = rec.dockCollapsed === true;
		if (typeof rec.company === 'string') fresh.company = rec.company.slice(0, 40);
		evaluateBook(fresh);
		return fresh;
	} catch {
		fresh.recovered = true;
		fresh.notice = '年报读不出来，已回到示例表。其它轻心数据没动。';
		evaluateBook(fresh);
		return fresh;
	}
}
