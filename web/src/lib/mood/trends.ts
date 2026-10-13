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
	_period: 'week' | 'month',
	tag?: string
): TrendPoint[] {
	const buckets = new Map<string, { sum: number; count: number }>();
	for (const log of logs) {
		if (tag && !log.tags.includes(tag)) continue;
		const date = log.createdAt.slice(0, 10);
		const current = buckets.get(date) ?? { sum: 0, count: 0 };
		current.sum += log.score;
		current.count += 1;
		buckets.set(date, current);
	}
	return [...buckets.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, { sum, count }]) => ({
			date,
			averageScore: sum / count,
			count
		}));
}
