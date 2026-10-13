export interface MoodLog {
	id: string;
	emoji: string;
	score: number;
	tags: string[];
	note: string | null;
	createdAt: string;
}

export interface TrendPoint {
	date: string;
	averageScore: number;
	count: number;
}

export function aggregateTrends(
	logs: MoodLog[],
	period: 'week' | 'month',
	tag?: string,
	now: number = Date.now()
): TrendPoint[] {
	const span = period === 'week' ? 7 : 30;
	const end = new Date(now);
	const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
	const startUtc = endUtc - (span - 1) * 86_400_000;
	const buckets = new Map<string, { sum: number; count: number }>();
	for (let offset = 0; offset < span; offset += 1) {
		const date = new Date(startUtc + offset * 86_400_000).toISOString().slice(0, 10);
		buckets.set(date, { sum: 0, count: 0 });
	}
	for (const log of logs) {
		if (tag && !log.tags.includes(tag)) continue;
		const date = log.createdAt.slice(0, 10);
		const current = buckets.get(date);
		if (!current) continue;
		current.sum += log.score;
		current.count += 1;
	}
	return [...buckets.entries()].map(([date, { sum, count }]) => ({
		date,
		averageScore: count === 0 ? 0 : sum / count,
		count
	}));
}
