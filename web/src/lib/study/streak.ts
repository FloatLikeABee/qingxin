function shiftDay(iso: string, delta: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + delta);
	return date.toISOString().slice(0, 10);
}

export function shanghaiToday(now = new Date()): string {
	const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
	return shifted.toISOString().slice(0, 10);
}

export function currentStreak(days: string[], today: string): number {
	const set = new Set(days);
	const start = set.has(today) ? today : set.has(shiftDay(today, -1)) ? shiftDay(today, -1) : null;
	if (!start) return 0;
	let n = 0;
	let cursor = start;
	while (set.has(cursor)) {
		n += 1;
		cursor = shiftDay(cursor, -1);
	}
	return n;
}
