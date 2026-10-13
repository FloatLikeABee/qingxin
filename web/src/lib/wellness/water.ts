export const DEFAULT_TARGET_ML = 2000;
export const DEFAULT_CUP_ML = 250;

export function shanghaiToday(): string {
	return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function progressPercent(totalMl: number, targetMl: number): number {
	if (targetMl <= 0) return 0;
	return Math.min(100, Math.round((totalMl * 100) / targetMl));
}

function minutes(hhmm: string): number {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
}

function formatMinutes(value: number): string {
	const hour = Math.floor(value / 60);
	const minute = value % 60;
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function expandInterval(start: string, end: string, everyHours: number): string[] {
	if (everyHours < 1) return [];
	const begin = minutes(start);
	const stop = minutes(end);
	const step = everyHours * 60;
	const times: string[] = [];
	for (let cur = begin; cur <= stop; cur += step) {
		times.push(formatMinutes(cur));
	}
	return times;
}
