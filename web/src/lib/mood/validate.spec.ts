import { describe, expect, it } from 'vitest';
import { validateCheckIn } from './validate';

describe('validateCheckIn', () => {
	it('accepts a catalog emoji, tags, and a short note', () => {
		const result = validateCheckIn({
			emoji: '😔',
			tags: ['睡眠'],
			note: '夜里醒了两次'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.score).toBe(2);
			expect(result.value.note).toBe('夜里醒了两次');
		}
	});

	it('rejects a note of 100 characters', () => {
		const result = validateCheckIn({
			emoji: '🙂',
			tags: ['工作'],
			note: '字'.repeat(100)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe('invalid_request');
	});

	it('rejects an unknown emoji', () => {
		const result = validateCheckIn({ emoji: '🤖', tags: [], note: '' });
		expect(result.ok).toBe(false);
	});
});
