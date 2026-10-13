import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET_ML, expandInterval, progressPercent } from './water';

describe('water progress and interval expansion', () => {
	it('shows 50 percent after four 250 ml cups toward 2000 ml', () => {
		expect(DEFAULT_TARGET_ML).toBe(2000);
		expect(progressPercent(1000, 2000)).toBe(50);
		expect(progressPercent(0, 2000)).toBe(0);
		expect(progressPercent(2500, 2000)).toBe(100);
	});

	it('expands 09:00–13:00 every 2 hours inclusively', () => {
		expect(expandInterval('09:00', '13:00', 2)).toEqual(['09:00', '11:00', '13:00']);
	});

	it('expands the default 08:00–22:00 window into eight times', () => {
		expect(expandInterval('08:00', '22:00', 2)).toEqual([
			'08:00',
			'10:00',
			'12:00',
			'14:00',
			'16:00',
			'18:00',
			'20:00',
			'22:00'
		]);
	});
});
