export interface QuoteInput {
	hours: number;
	difficulty: number;
	hourlyRate?: number;
}

export interface QuoteSheet {
	hours: number;
	difficulty: number;
	hourlyRate: number;
	multiplier: number;
	total: number;
}

export type QuoteResult =
	{ ok: true; value: QuoteSheet } | { ok: false; code: 'invalid_request'; message: string };

export function quoteSheet(input: QuoteInput): QuoteResult {
	const hours = Number(input.hours);
	const difficulty = Number(input.difficulty);
	const hourlyRate = input.hourlyRate ?? 200;
	if (!Number.isFinite(hours) || hours <= 0) {
		return { ok: false, code: 'invalid_request', message: '工时需要大于 0' };
	}
	if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
		return { ok: false, code: 'invalid_request', message: '难度需要在 1 到 5 之间' };
	}
	if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
		return { ok: false, code: 'invalid_request', message: '单价需要大于 0' };
	}
	const multiplier = Number((0.7 + difficulty * 0.3).toFixed(1));
	const total = Math.round(hours * hourlyRate * multiplier);
	return { ok: true, value: { hours, difficulty, hourlyRate, multiplier, total } };
}
