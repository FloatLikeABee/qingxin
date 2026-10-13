import { describe, expect, it } from 'vitest';
import { formatMmSs, remaining, WORK_SECONDS } from './timer';

describe('focus timer', () => {
	it('formats remaining pomodoro time', () => {
		expect(WORK_SECONDS).toBe(1500);
		expect(remaining(WORK_SECONDS, 10)).toBe(1490);
		expect(formatMmSs(1490)).toBe('24:50');
		expect(remaining(WORK_SECONDS, WORK_SECONDS + 5)).toBe(0);
	});
});
