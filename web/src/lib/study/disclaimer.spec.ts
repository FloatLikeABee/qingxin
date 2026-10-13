import { describe, expect, it } from 'vitest';
import { DISCLAIMER, TARGET_DAYS } from './disclaimer';

describe('study disclaimer', () => {
	it('is the fixed habit-tool notice', () => {
		expect(DISCLAIMER).toBe('本模块为学习习惯记录工具，不构成教学辅导或心理咨询。');
		expect(TARGET_DAYS).toEqual([7, 14, 21]);
	});
});
