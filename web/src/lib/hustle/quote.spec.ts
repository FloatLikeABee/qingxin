import { describe, expect, it } from 'vitest';
import { quoteSheet } from './quote';

describe('quoteSheet', () => {
	it('uses default hourly rate 200 and difficulty multiplier 0.7 + d*0.3', () => {
		const sheet = quoteSheet({ hours: 10, difficulty: 3 });
		expect(sheet.ok).toBe(true);
		if (sheet.ok) {
			expect(sheet.value.hourlyRate).toBe(200);
			expect(sheet.value.multiplier).toBe(1.6);
			expect(sheet.value.total).toBe(3200);
			expect(sheet.value.hours).toBe(10);
			expect(sheet.value.difficulty).toBe(3);
		}
	});

	it('rejects invalid hours or difficulty', () => {
		expect(quoteSheet({ hours: 0, difficulty: 3 }).ok).toBe(false);
		expect(quoteSheet({ hours: 8, difficulty: 0 }).ok).toBe(false);
		expect(quoteSheet({ hours: 8, difficulty: 6 }).ok).toBe(false);
	});
});
