import { describe, expect, it } from 'vitest';
import { findDue, isDue, occurrenceAtIso } from './due';

const weekday = {
	id: 'med-1',
	time: '08:00',
	daysOfWeek: [1, 2, 3, 4, 5]
};

describe('medication due window', () => {
	it('stays closed before the dose time on a scheduled Monday', () => {
		expect(isDue(weekday, new Date('2026-10-11T23:00:00.000Z'), [])).toBe(false);
	});

	it('opens at 08:05 Monday when not acked today', () => {
		expect(isDue(weekday, new Date('2026-10-12T00:05:00.000Z'), [])).toBe(true);
	});

	it('stays closed on Saturday', () => {
		expect(isDue(weekday, new Date('2026-10-17T00:05:00.000Z'), [])).toBe(false);
	});

	it('stays closed after an ack today', () => {
		expect(isDue(weekday, new Date('2026-10-12T00:05:00.000Z'), ['med-1'])).toBe(false);
	});

	it('opens again the next scheduled day after yesterday ack', () => {
		expect(isDue(weekday, new Date('2026-10-13T00:05:00.000Z'), [])).toBe(true);
	});

	it('stays closed after the 60 minute grace', () => {
		expect(isDue(weekday, new Date('2026-10-12T01:05:00.000Z'), [])).toBe(false);
	});

	it('picks the first due reminder', () => {
		const due = findDue(
			[{ id: 'later', time: '21:00', daysOfWeek: [1] }, weekday],
			new Date('2026-10-12T00:05:00.000Z'),
			[]
		);
		expect(due?.id).toBe('med-1');
	});

	it('formats today occurrence as RFC3339 with an offset', () => {
		expect(occurrenceAtIso('2026-10-12', '08:00')).toBe('2026-10-12T00:00:00+00:00');
	});
});
