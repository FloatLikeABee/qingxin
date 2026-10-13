import { describe, expect, it } from 'vitest';
import { aggregateTrends, type MoodLog } from './trends';

function log(partial: Partial<MoodLog> & Pick<MoodLog, 'id' | 'score' | 'createdAt'>): MoodLog {
	return {
		emoji: '😐',
		tags: [],
		note: null,
		...partial
	};
}

describe('aggregateTrends', () => {
	it('averages scores on the same UTC day', () => {
		const points = aggregateTrends(
			[
				log({ id: '1', score: 2, createdAt: '2026-10-13T01:00:00Z', tags: ['睡眠'] }),
				log({ id: '2', score: 4, createdAt: '2026-10-13T08:00:00Z', tags: ['工作'] })
			],
			'week'
		);
		const day = points.find((point) => point.date === '2026-10-13');
		expect(day).toEqual({ date: '2026-10-13', averageScore: 3, count: 2 });
	});

	it('filters by tag', () => {
		const points = aggregateTrends(
			[
				log({ id: '1', score: 2, createdAt: '2026-10-13T01:00:00Z', tags: ['睡眠'] }),
				log({ id: '2', score: 5, createdAt: '2026-10-13T08:00:00Z', tags: ['工作'] })
			],
			'month',
			'工作'
		);
		expect(points).toEqual([{ date: '2026-10-13', averageScore: 5, count: 1 }]);
	});
});
