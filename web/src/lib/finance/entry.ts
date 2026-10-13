import { fenFromYuanInput } from './money';
import type { FinanceCategory, TxType } from './types';

export type EntryStep = 'amount' | 'category' | 'confirm' | 'done';

export interface EntryState {
	type: TxType;
	digits: string;
	category: FinanceCategory | null;
	step: EntryStep;
	note: string;
}

export interface ConfirmedEntry extends EntryState {
	amountFen: number;
	categoryName: string;
	step: 'done';
}

export function createEntry(type: TxType = 'expense'): EntryState {
	return { type, digits: '', category: null, step: 'amount', note: '' };
}

export function typeDigit(entry: EntryState, key: string): EntryState {
	if (key === 'back') {
		return { ...entry, digits: entry.digits.slice(0, -1) };
	}
	if (key === '.') {
		if (entry.digits.includes('.')) return entry;
		return { ...entry, digits: `${entry.digits || '0'}.` };
	}
	if (!/^\d$/.test(key)) return entry;
	const [whole, frac] = entry.digits.split('.');
	if (frac !== undefined && frac.length >= 2) return entry;
	if (frac === undefined && whole.length >= 8) return entry;
	const next = entry.digits === '0' ? key : `${entry.digits}${key}`;
	return { ...entry, digits: next };
}

export function selectCategory(entry: EntryState, category: FinanceCategory): EntryState {
	return { ...entry, type: category.kind, category, step: 'confirm' };
}

export function confirmEntry(entry: EntryState): ConfirmedEntry | null {
	const amountFen = fenFromYuanInput(entry.digits);
	if (!amountFen || !entry.category) return null;
	return {
		...entry,
		amountFen,
		categoryName: entry.category.name,
		step: 'done'
	};
}
