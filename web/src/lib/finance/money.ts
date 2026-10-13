import type { SubCycle } from './types';

export function fenFromYuanInput(raw: string): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
	const [yuan, cents = ''] = trimmed.split('.');
	const fen = Number(yuan) * 100 + Number(cents.padEnd(2, '0'));
	if (!Number.isFinite(fen) || fen <= 0) return null;
	return fen;
}

export function yuanDigitsToFen(digits: string, scale = 2): number | null {
	if (!digits) return null;
	const fen = Number(digits.padStart(scale + 1, '0')) / 10 ** (2 - scale);
	const asFen = Number(digits);
	if (!Number.isFinite(asFen) || asFen <= 0) return null;
	return asFen;
}

export function formatYuan(fen: number): string {
	const sign = fen < 0 ? '-' : '';
	return `${sign}${(Math.abs(fen) / 100).toFixed(2)}`;
}

export function displayYuan(digits: string): string {
	if (!digits) return '0.00';
	const [whole, frac = ''] = digits.split('.');
	return `${whole || '0'}.${frac.padEnd(2, '0').slice(0, 2)}`;
}

export function formatYuanLabel(fen: number): string {
	return `¥${formatYuan(fen)}`;
}

export function annualCostFen(priceFen: number, cycle: SubCycle): number {
	if (cycle === 'weekly') return priceFen * 52;
	if (cycle === 'monthly') return priceFen * 12;
	if (cycle === 'quarterly') return priceFen * 4;
	return priceFen;
}

export function todayIso(now = new Date()): string {
	const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
	return shanghai.toISOString().slice(0, 10);
}

export function currentMonth(now = new Date()): string {
	return todayIso(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
	const [year, mon] = month.split('-').map(Number);
	const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
