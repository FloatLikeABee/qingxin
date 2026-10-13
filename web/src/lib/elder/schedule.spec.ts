import { describe, expect, it } from 'vitest';
import { REMINDER_DISCLAIMER, nextOccurrenceIso, validateReminderSchedule } from './schedule';

describe('elder reminder schedule', () => {
	it('rejects cron and empty weekdays', () => {
		expect(validateReminderSchedule({ time: '08:00', daysOfWeek: [] }).ok).toBe(false);
		expect(
			validateReminderSchedule({
				time: '08:00',
				daysOfWeek: [1],
				scheduleCron: '0 8 * * *'
			}).ok
		).toBe(false);
	});

	it('accepts a weekday morning and computes the next Shanghai occurrence', () => {
		const parsed = validateReminderSchedule({ time: '08:00', daysOfWeek: [1, 2, 3, 4, 5] });
		expect(parsed.ok).toBe(true);
		const from = new Date('2026-10-13T01:00:00.000Z');
		expect(nextOccurrenceIso('08:00', [1, 2, 3, 4, 5], 'Asia/Shanghai', from)).toBe(
			'2026-10-14T00:00:00.000Z'
		);
	});

	it('ships the not-alarm-reliable disclaimer', () => {
		expect(REMINDER_DISCLAIMER.includes('闹钟') || REMINDER_DISCLAIMER.includes('不能替代')).toBe(
			true
		);
	});
});
