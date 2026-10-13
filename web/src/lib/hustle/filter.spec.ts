import { describe, expect, it } from 'vitest';
import { filterQuestions, filterSideHustles } from './filter';
import { INTERVIEW_QUESTIONS, SEED_SIDE_HUSTLES } from './catalog';

describe('hustle filters', () => {
	it('filters questions by role', () => {
		const front = filterQuestions(INTERVIEW_QUESTIONS, { role: '前端' });
		expect(front.length).toBeGreaterThan(0);
		expect(front.every((item) => item.role === '前端')).toBe(true);
	});

	it('filters side hustles by kind', () => {
		const offline = filterSideHustles(SEED_SIDE_HUSTLES, '线下');
		expect(offline.length).toBeGreaterThan(0);
		expect(offline.every((item) => item.kind === '线下')).toBe(true);
	});
});
