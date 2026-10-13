import type { PetRecord, PetWeight } from './types';

export interface CalendarDay {
	date: string;
	inMonth: boolean;
}

export function monthGrid(month: string): CalendarDay[] {
	const [year, monthNum] = month.split('-').map(Number);
	const first = new Date(Date.UTC(year ?? 2026, (monthNum ?? 1) - 1, 1));
	const weekday = (first.getUTCDay() + 6) % 7;
	const start = new Date(first);
	start.setUTCDate(first.getUTCDate() - weekday);
	const days: CalendarDay[] = [];
	for (let index = 0; index < 42; index += 1) {
		const day = new Date(start);
		day.setUTCDate(start.getUTCDate() + index);
		const date = day.toISOString().slice(0, 10);
		days.push({ date, inMonth: date.startsWith(month) });
	}
	return days;
}

export function calendarMarks(
	month: string,
	records: PetRecord[],
	weights: PetWeight[]
): Record<string, string[]> {
	const marks: Record<string, string[]> = {};
	const add = (date: string | null | undefined, tag: string) => {
		if (!date || !date.startsWith(month)) return;
		const list = marks[date] ?? [];
		if (!list.includes(tag)) list.push(tag);
		marks[date] = list;
	};
	for (const record of records) {
		add(record.date, record.type);
		add(record.nextDueDate, 'due');
	}
	for (const weight of weights) {
		add(weight.measuredOn, 'weight');
	}
	return marks;
}

export function currentMonth(now = new Date()): string {
	const local = new Date(now.getTime() + 8 * 3600_000);
	return local.toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
	const [year, monthNum] = month.split('-').map(Number);
	const date = new Date(Date.UTC(year ?? 2026, (monthNum ?? 1) - 1 + delta, 1));
	return date.toISOString().slice(0, 7);
}
