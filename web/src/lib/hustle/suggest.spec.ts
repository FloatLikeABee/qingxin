import { describe, expect, it } from 'vitest';
import { DISCLAIMER, mockOptimize, mockInterviewer, mockSuggestions } from './ai';

describe('stubbed AI copy', () => {
	it('keeps a career-advice disclaimer', () => {
		expect(DISCLAIMER).toContain('不构成');
	});

	it('optimizes a resume deterministically from name and title', () => {
		const text = mockOptimize('林轻心', '前端工程师');
		expect(text).toContain('林轻心');
		expect(mockOptimize('林轻心', '前端工程师')).toBe(text);
	});

	it('asks a deterministic follow-up for the same question', () => {
		const q = '解释盒模型';
		expect(mockInterviewer(q)).toBe(mockInterviewer(q));
		expect(mockInterviewer(q).length).toBeGreaterThan(4);
	});

	it('suggests at least two cards and is stable when skills are shuffled', () => {
		const a = mockSuggestions(['设计', '写作'], 6);
		const b = mockSuggestions(['写作', '设计'], 6);
		expect(a.length).toBeGreaterThanOrEqual(2);
		expect(a[0]?.estimatedIncome).toBeGreaterThan(0);
		expect(b).toEqual(a);
	});
});
