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
			'week',
			undefined,
			Date.parse('2026-10-13T12:00:00Z')
		);
		const day = points.find((point) => point.date === '2026-10-13');
		expect(day).toEqual({ date: '2026-10-13', averageScore: 3, count: 2 });
	});

	it('filters by tag', () => {
		const now = Date.parse('2026-10-13T12:00:00Z');
		const points = aggregateTrends(
			[
				log({ id: '1', score: 2, createdAt: '2026-10-13T01:00:00Z', tags: ['睡眠'] }),
				log({ id: '2', score: 5, createdAt: '2026-10-13T08:00:00Z', tags: ['工作'] })
			],
			'month',
			'工作',
			now
		);
		const day = points.find((point) => point.date === '2026-10-13');
		expect(day).toEqual({ date: '2026-10-13', averageScore: 5, count: 1 });
	});

	it('keeps a 20-day-old log in month but not in week', () => {
		const now = Date.parse('2026-10-13T12:00:00Z');
		const logs = [
			log({ id: 'old', score: 5, createdAt: '2026-09-23T12:00:00Z' }),
			log({ id: 'new', score: 2, createdAt: '2026-10-13T01:00:00Z' })
		];
		const week = aggregateTrends(logs, 'week', undefined, now);
		const month = aggregateTrends(logs, 'month', undefined, now);
		expect(week.find((point) => point.date === '2026-09-23')).toBeUndefined();
		expect(week.find((point) => point.date === '2026-10-13')?.count).toBe(1);
		expect(month.find((point) => point.date === '2026-09-23')?.count).toBe(1);
		expect(week).toHaveLength(7);
		expect(month).toHaveLength(30);
	});
});
